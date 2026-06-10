// Supabase Edge Function: sync-github-stats (JSONB Compatible Version)
// Serves as a daily cron job to sync student contribution stats and award badges.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GITHUB_PAT = Deno.env.get("GITHUB_PAT") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const POINTS_PER_COMMIT = 10;
const POINTS_PER_PR = 20;
const POINTS_PER_ISSUE = 5;
const POINTS_PER_STAR = 15;

interface BadgeCriterion {
  type: string;          // e.g., 'first_commit', 'streak'
  target_days?: number;   // e.g., 3 for a 3-day streak
  metric?: string;        // e.g., 'commits'
}

serve(async (req) => {
  try {
    // 1. Fetch all students
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("*");

    if (studentsError) throw studentsError;
    if (!students || students.length === 0) {
      return new Response(JSON.stringify({ message: "No students to sync." }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0]; // YYYY-MM-DD

    // 2. Fetch all badges
    const { data: dbBadges, error: badgesError } = await supabase
      .from("badges")
      .select("id, criterio_desbloqueo");
    if (badgesError) throw badgesError;

    const results = [];

    for (const student of students) {
      let commits = 0;
      let pull_requests = 0;
      let issues = 0;
      let stars_received = 0;

      // 3. GitHub API fetch
      try {
        const headers: HeadersInit = {
          "Accept": "application/vnd.github.v3+json",
        };
        if (GITHUB_PAT) {
          headers["Authorization"] = `Bearer ${GITHUB_PAT}`;
        }

        const response = await fetch(
          `https://api.github.com/users/${student.github_username}/events`,
          { headers }
        );

        if (response.ok) {
          const events = await response.json();
          events.forEach((event: any) => {
            const eventDate = event.created_at ? event.created_at.split("T")[0] : "";
            if (eventDate === dateStr) {
              if (event.type === "PushEvent") {
                commits += event.payload?.commits?.length || 1;
              } else if (event.type === "PullRequestEvent" && event.payload?.action === "opened") {
                pull_requests += 1;
              } else if (event.type === "IssuesEvent" && event.payload?.action === "opened") {
                issues += 1;
              } else if (event.type === "WatchEvent" && event.payload?.action === "started") {
                stars_received += 1;
              }
            }
          });
        }
      } catch (err) {
        console.error(`Error querying GitHub API for ${student.github_username}:`, err);
      }

      // 4. Save to github_stats using JSONB structure
      const { error: statsError } = await supabase
        .from("github_stats")
        .upsert(
          {
            student_id: student.id,
            fecha: dateStr,
            stats: {
              commits,
              pull_requests,
              issues,
              stars_received,
            },
          },
          { onConflict: "student_id,fecha" }
        );

      if (statsError) {
        console.error(`Failed to upsert stats for student ${student.id}:`, statsError);
        continue;
      }

      // 5. Recalculate score from JSONB database values
      const { data: allStats, error: allStatsError } = await supabase
        .from("github_stats")
        .select("stats")
        .eq("student_id", student.id);

      if (allStatsError) {
        console.error(`Error reading historical stats for student ${student.id}:`, allStatsError);
        continue;
      }

      let newScore = 0;
      let totalCommits = 0;

      allStats?.forEach((row) => {
        const statsObj = row.stats || {};
        const c = statsObj.commits || 0;
        const pr = statsObj.pull_requests || 0;
        const iss = statsObj.issues || 0;
        const star = statsObj.stars_received || 0;

        totalCommits += c;
        newScore +=
          c * POINTS_PER_COMMIT +
          pr * POINTS_PER_PR +
          iss * POINTS_PER_ISSUE +
          star * POINTS_PER_STAR;
      });

      await supabase
        .from("students")
        .update({ total_score: newScore })
        .eq("id", student.id);

      // 6. Dynamic Badge Evaluation
      for (const badge of dbBadges || []) {
        const criterion = (badge.criterio_desbloqueo as unknown as BadgeCriterion) || {};

        if (criterion.type === "first_commit") {
          if (totalCommits > 0) {
            await awardBadge(student.id, badge.id);
          }
        } 
        
        else if (criterion.type === "streak") {
          const targetDays = criterion.target_days || 3;
          const metric = criterion.metric || "commits";

          // Fetch daily contributions ordered by date
          const { data: history, error: historyErr } = await supabase
            .from("github_stats")
            .select("fecha, stats")
            .eq("student_id", student.id)
            .order("fecha", { ascending: true });

          if (!historyErr && history) {
            let consecutiveDays = 0;
            let maxConsecutive = 0;
            let lastDate: Date | null = null;

            for (const row of history) {
              const val = row.stats?.[metric] || 0;
              if (val > 0) {
                const currentDate = new Date(row.fecha);
                if (lastDate === null) {
                  consecutiveDays = 1;
                } else {
                  const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  if (diffDays === 1) {
                    consecutiveDays++;
                  } else if (diffDays > 1) {
                    consecutiveDays = 1;
                  }
                }
                lastDate = currentDate;
                if (consecutiveDays > maxConsecutive) {
                  maxConsecutive = consecutiveDays;
                }
              }
            }

            if (maxConsecutive >= targetDays) {
              await awardBadge(student.id, badge.id);
            }
          }
        }
      }

      results.push({
        student: student.github_username,
        stats_updated: true,
        new_score: newScore,
      });
    }

    return new Response(JSON.stringify({ status: "success", results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function awardBadge(studentId: string, badgeId: string) {
  const { error } = await supabase
    .from("student_badges")
    .insert({
      student_id: studentId,
      badge_id: badgeId,
    });
  if (error && error.code !== "23505") {
    console.error(`Error awarding badge ${badgeId} to student ${studentId}:`, error);
  }
}
