// Supabase Edge Function: sync-github-stats (JSONB Compatible Version)
// Serves as a daily cron job to sync dev contribution stats and award badges.

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
    // 1. Fetch all devs
    const { data: devs, error: devsError } = await supabase
      .from("devs")
      .select("*");

    if (devsError) throw devsError;
    if (!devs || devs.length === 0) {
      return new Response(JSON.stringify({ message: "No devs to sync." }), {
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

    for (const dev of devs) {
      let commits = 0;
      let pull_requests = 0;
      let issues = 0;
      let stars_received = 0;

      // 3. GitHub API fetch
      try {
        // Use GraphQL for syncing to get exact historical contribution count and details
        const query = `
          query($username: String!) {
            user(login: $username) {
              name
              avatarUrl
              contributionsCollection {
                totalCommitContributions
                totalPullRequestContributions
                totalIssueContributions
                contributionCalendar {
                  totalContributions
                  weeks {
                    contributionDays {
                      date
                      contributionCount
                    }
                  }
                }
              }
            }
          }
        `;

        const headers: HeadersInit = {
          "Content-Type": "application/json",
          "Accept": "application/json",
        };
        if (GITHUB_PAT) {
          headers["Authorization"] = `Bearer ${GITHUB_PAT}`;
        }

        const response = await fetch("https://api.github.com/graphql", {
          method: "POST",
          headers,
          body: JSON.stringify({
            query,
            variables: { username: dev.github_username },
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const userObj = result.data?.user;
          if (userObj) {
            const collection = userObj.contributionsCollection;
            const calendar = collection.contributionCalendar;

            const weeks = calendar.weeks || [];
            for (const week of weeks) {
              const days = week.contributionDays || [];
              for (const day of days) {
                const dateStr = day.date;
                const count = day.contributionCount || 0;

                await supabase.from("github_stats").upsert({
                  dev_id: dev.id,
                  fecha: dateStr,
                  stats: { commits: count, pull_requests: 0, issues: 0, stars_received: 0 },
                }, { onConflict: "dev_id,fecha" });
              }
            }

            const commits = collection.totalCommitContributions || 0;
            const prs = collection.totalPullRequestContributions || 0;
            const issues = collection.totalIssueContributions || 0;

            const newScore = commits * POINTS_PER_COMMIT + prs * POINTS_PER_PR + issues * POINTS_PER_ISSUE;
            const totalContributions = calendar.totalContributions || 0;

            const updateData: any = {
              total_score: newScore,
              total_contributions: totalContributions
            };
            if (userObj.avatarUrl) {
              updateData.avatar_url = userObj.avatarUrl;
            }
            if (userObj.name) {
              updateData.nombre = userObj.name;
            }

            await supabase
              .from("devs")
              .update(updateData)
              .eq("id", dev.id);
          }
        }
      } catch (err) {
        console.error(`Error querying GitHub API for ${dev.github_username}:`, err);
      }

      // 6. Dynamic Badge Evaluation
      for (const badge of dbBadges || []) {
        const criterion = (badge.criterio_desbloqueo as unknown as BadgeCriterion) || {};

        if (criterion.type === "first_commit") {
          if (totalCommits > 0) {
            await awardBadge(dev.id, badge.id);
          }
        } 
        
        else if (criterion.type === "streak") {
          const targetDays = criterion.target_days || 3;
          const metric = criterion.metric || "commits";

          // Fetch daily contributions ordered by date
          const { data: history, error: historyErr } = await supabase
            .from("github_stats")
            .select("fecha, stats")
            .eq("dev_id", dev.id)
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
              await awardBadge(dev.id, badge.id);
            }
          }
        }
      }

      results.push({
        dev: dev.github_username,
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

async function awardBadge(devId: string, badgeId: string) {
  const { error } = await supabase
    .from("dev_badges")
    .insert({
      dev_id: devId,
      badge_id: badgeId,
    });
  if (error && error.code !== "23505") {
    console.error(`Error awarding badge ${badgeId} to dev ${devId}:`, error);
  }
}
