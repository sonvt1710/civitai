import { createJob, UNRUNNABLE_JOB_CRON } from './job';
import * as searchIndex from '~/server/search-index';
import { bountiesSearchIndex } from '~/server/search-index';

const searchIndexSets = {
  models: searchIndex.modelsSearchIndex,
  users: searchIndex.usersSearchIndex,
  articles: searchIndex.articlesSearchIndex,
  images: searchIndex.imagesSearchIndex,
  collections: searchIndex.collectionsSearchIndex,
  bounties: searchIndex.bountiesSearchIndex,
};

export const searchIndexJobs = Object.entries(searchIndexSets)
  .map(([name, searchIndexProcessor]) => [
    createJob(
      `search-index-sync-${name}`,
      `*/5 * * * *`,
      async () => {
        const searchIndexSyncTime = await timedExecution(searchIndexProcessor.update);

        return {
          [name]: searchIndexSyncTime,
        };
      },
      {
        lockExpiration: 30 * 60,
      }
    ),
    createJob(
      `search-index-sync-${name}-reset`,
      UNRUNNABLE_JOB_CRON,
      async () => {
        const searchIndexSyncTime = await timedExecution(searchIndexProcessor.reset);
        return {
          [`${name}-reset`]: searchIndexSyncTime,
        };
      },
      {
        // 3hr lock. This can be a long-running job.
        lockExpiration: 180 * 60,
      }
    ),
  ])
  .flat();

async function timedExecution<T>(fn: () => Promise<T>) {
  const start = Date.now();
  await fn();
  return Date.now() - start;
}
