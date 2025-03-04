import { Stack, Text, Box, Center, Loader, Title, ThemeIcon, Card, Group } from '@mantine/core';
import { useInfiniteHits, useInstantSearch } from 'react-instantsearch';

import { SortBy } from '~/components/Search/CustomSearchComponents';
import { useMemo } from 'react';
import { SearchHeader } from '~/components/Search/SearchHeader';
import { UserSearchIndexRecord } from '~/server/search-index/users.search-index';
import { IconCloudOff } from '@tabler/icons-react';
import { TimeoutLoader } from '~/components/Search/TimeoutLoader';
import { SearchLayout, useSearchLayoutStyles } from '~/components/Search/SearchLayout';
import { UserAvatar } from '~/components/UserAvatar/UserAvatar';
import { formatDate } from '~/utils/date-helpers';
import { RankBadge } from '~/components/Leaderboard/RankBadge';
import { useHiddenPreferencesContext } from '~/providers/HiddenPreferencesProvider';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { applyUserPreferencesUsers } from '~/components/Search/search.utils';
import { USERS_SEARCH_INDEX } from '~/server/common/constants';
import { UsersSearchIndexSortBy } from '~/components/Search/parsers/user.parser';
import { UserStatBadges } from '~/components/UserStatBadges/UserStatBadges';
import Link from 'next/link';
import { FollowUserButton } from '~/components/FollowUserButton/FollowUserButton';
import { InViewLoader } from '~/components/InView/InViewLoader';

export default function UserSearch() {
  return (
    <SearchLayout.Root>
      <SearchLayout.Filters>
        <RenderFilters />
      </SearchLayout.Filters>
      <SearchLayout.Content>
        <SearchHeader />
        <UserHitList />
      </SearchLayout.Content>
    </SearchLayout.Root>
  );
}

const RenderFilters = () => {
  return (
    <>
      <SortBy
        title="Sort users by"
        items={[
          { label: 'Relevancy', value: UsersSearchIndexSortBy[0] as string },
          { label: 'Most Followed', value: UsersSearchIndexSortBy[1] as string },
          { label: 'Highest Rated', value: UsersSearchIndexSortBy[2] as string },
          { label: 'Most Uploads', value: UsersSearchIndexSortBy[3] as string },
          { label: 'Newest', value: UsersSearchIndexSortBy[4] as string },
        ]}
      />
    </>
  );
};

export function UserHitList() {
  const { hits, showMore, isLastPage } = useInfiniteHits<UserSearchIndexRecord>();
  const { status } = useInstantSearch();
  const { classes, cx } = useSearchLayoutStyles();
  const currentUser = useCurrentUser();
  const { users: hiddenUsers, isLoading: loadingPreferences } = useHiddenPreferencesContext();

  const users = useMemo(() => {
    return applyUserPreferencesUsers<UserSearchIndexRecord>({
      items: hits,
      hiddenUsers,
      currentUserId: currentUser?.id,
    });
  }, [hits, hiddenUsers, currentUser]);

  const hiddenItems = hits.length - users.length;

  if (loadingPreferences) {
    return (
      <Box>
        <Center mt="md">
          <Loader />
        </Center>
      </Box>
    );
  }

  if (hits.length === 0) {
    const NotFound = (
      <Box>
        <Center>
          <Stack spacing="md" align="center" maw={800}>
            {hiddenItems > 0 && (
              <Text color="dimmed">{hiddenItems} users have been hidden due to your settings.</Text>
            )}
            <ThemeIcon size={128} radius={100} sx={{ opacity: 0.5 }}>
              <IconCloudOff size={80} />
            </ThemeIcon>
            <Title order={1} inline>
              No users found
            </Title>
            <Text align="center">
              We have a bunch of users, but it looks like we couldn&rsquo;t find any matching your
              query.
            </Text>
          </Stack>
        </Center>
      </Box>
    );

    const loading = status === 'loading' || status === 'stalled';

    if (loading) {
      return (
        <Box>
          <Center mt="md">
            <Loader />
          </Center>
        </Box>
      );
    }

    return (
      <Box>
        <Center mt="md">
          {/* Just enough time to avoid blank random page */}
          <TimeoutLoader renderTimeout={() => <>{NotFound}</>} delay={150} />
        </Center>
      </Box>
    );
  }

  return (
    <Stack>
      {hiddenItems > 0 && (
        <Text color="dimmed">{hiddenItems} users have been hidden due to your settings.</Text>
      )}
      <Box
        className={cx(classes.grid)}
        style={{
          // Overwrite default sizing here.
          gridTemplateColumns: `repeat(auto-fill, minmax(350px, 1fr))`,
        }}
      >
        {users.map((hit) => {
          return <UserCard key={hit.id} data={hit} />;
        })}
      </Box>
      {hits.length > 0 && !isLastPage && (
        <InViewLoader
          loadFn={showMore}
          loadCondition={status === 'idle'}
          style={{ gridColumn: '1/-1' }}
        >
          <Center p="xl" sx={{ height: 36 }} mt="md">
            <Loader />
          </Center>
        </InViewLoader>
      )}
    </Stack>
  );
}

export function UserCard({ data }: { data: UserSearchIndexRecord }) {
  if (!data) return null;

  const { stats } = data;

  return (
    <Link href={`/user/${data.username}`} passHref>
      <Card component="a" p="xs" withBorder>
        <Stack spacing="xs">
          <Group position="apart" spacing={8}>
            <UserAvatar
              size="sm"
              user={data}
              subText={`Joined ${formatDate(data.createdAt)}`}
              withUsername
            />
            <FollowUserButton userId={data.id} size="md" compact />
          </Group>
          {stats && (
            <Group spacing={8}>
              <RankBadge size="md" rank={data.rank} />
              <UserStatBadges
                rating={{ value: stats.ratingAllTime, count: stats.ratingCountAllTime }}
                uploads={stats.uploadCountAllTime}
                followers={stats.followerCountAllTime}
                favorite={stats.favoriteCountAllTime}
                downloads={stats.downloadCountAllTime}
              />
            </Group>
          )}
        </Stack>
      </Card>
    </Link>
  );
}

UserSearch.getLayout = function getLayout(page: React.ReactNode) {
  return <SearchLayout indexName={USERS_SEARCH_INDEX}>{page}</SearchLayout>;
};
