import { Stack, Text, Center, Loader, Title, ThemeIcon } from '@mantine/core';
import { useInstantSearch } from 'react-instantsearch';

import {
  BrowsingLevelFilter,
  ChipRefinementList,
  SearchableMultiSelectRefinementList,
  SortBy,
} from '~/components/Search/CustomSearchComponents';
import { SearchHeader } from '~/components/Search/SearchHeader';
import { IconCloudOff } from '@tabler/icons-react';
import { TimeoutLoader } from '~/components/Search/TimeoutLoader';
import { SearchLayout } from '~/components/Search/SearchLayout';
import { BOUNTIES_SEARCH_INDEX } from '~/server/common/constants';
import { BountiesSearchIndexSortBy } from '~/components/Search/parsers/bounties.parser';
import { BountyCard } from '~/components/Cards/BountyCard';
import { InViewLoader } from '~/components/InView/InViewLoader';
import { useInfiniteHitsTransformed } from '~/components/Search/search.utils2';
import { useApplyHiddenPreferences } from '~/components/HiddenPreferences/useApplyHiddenPreferences';
import classes from '~/components/Search/SearchLayout.module.scss';

export default function BountySearch() {
  return (
    <SearchLayout.Root>
      <SearchLayout.Content>
        <SearchHeader />
        <BountyHitList />
      </SearchLayout.Content>
    </SearchLayout.Root>
  );
}

const RenderFilters = () => {
  return (
    <>
      <BrowsingLevelFilter attributeName="nsfwLevel" />
      <SortBy
        title="Sort bounties by"
        items={[
          { label: 'Relevancy', value: BountiesSearchIndexSortBy[0] as string },
          { label: 'Most Buzz', value: BountiesSearchIndexSortBy[1] as string },
          { label: 'Entry Count', value: BountiesSearchIndexSortBy[2] as string },
          { label: 'Favorite', value: BountiesSearchIndexSortBy[3] as string },
          { label: 'Newest', value: BountiesSearchIndexSortBy[4] as string },
        ]}
      />
      <ChipRefinementList title="Filter by type" attribute="type" sortBy={['name']} />
      <ChipRefinementList
        title="Filter by Base Model"
        attribute="details.baseModel"
        sortBy={['name']}
      />
      <SearchableMultiSelectRefinementList title="Users" attribute="user.username" searchable />
      <SearchableMultiSelectRefinementList title="Tags" attribute="tags.name" searchable />
    </>
  );
};

export function BountyHitList() {
  const { hits, showMore, isLastPage } = useInfiniteHitsTransformed<'bounties'>();
  const { status } = useInstantSearch();

  const { loadingPreferences, items, hiddenCount } = useApplyHiddenPreferences({
    type: 'bounties',
    data: hits,
  });

  if (loadingPreferences) {
    return (
      <div>
        <Center mt="md">
          <Loader />
        </Center>
      </div>
    );
  }

  if (hits.length === 0) {
    const NotFound = (
      <div>
        <Center>
          <Stack gap="md" align="center" maw={800}>
            {hiddenCount > 0 && (
              <Text c="dimmed">{hiddenCount} bounties have been hidden due to your settings.</Text>
            )}
            <ThemeIcon size={128} radius={100} className="opacity-50">
              <IconCloudOff size={80} />
            </ThemeIcon>
            <Title order={1} lh={1}>
              No bounties found
            </Title>
            <Text align="center">
              We have a bunch of bounties, but it looks like we couldn&rsquo;t find any matching
              your query.
            </Text>
          </Stack>
        </Center>
      </div>
    );

    const loading = status === 'loading' || status === 'stalled';

    if (loading) {
      return (
        <div>
          <Center mt="md">
            <Loader />
          </Center>
        </div>
      );
    }

    return (
      <div>
        <Center mt="md">
          {/* Just enough time to avoid blank random page */}
          <TimeoutLoader renderTimeout={() => <>{NotFound}</>} delay={150} />
        </Center>
      </div>
    );
  }

  return (
    <Stack>
      {hiddenCount > 0 && (
        <Text c="dimmed">{hiddenCount} bounties have been hidden due to your settings.</Text>
      )}
      <div
        className={classes.grid}
        style={{
          // Overwrite default sizing here.
          gridTemplateColumns: `repeat(auto-fill, minmax(320px, 1fr))`,
        }}
      >
        {items.map((hit) => {
          // TODO - fix type
          return <BountyCard key={hit.id} data={hit as any} />;
        })}
      </div>
      {hits.length > 0 && !isLastPage && (
        <InViewLoader
          loadFn={showMore}
          loadCondition={status === 'idle'}
          style={{ gridColumn: '1/-1' }}
        >
          <Center p="xl" style={{ height: 36 }} mt="md">
            <Loader />
          </Center>
        </InViewLoader>
      )}
    </Stack>
  );
}

BountySearch.getLayout = function getLayout(page: React.ReactNode) {
  return (
    <SearchLayout
      indexName={BOUNTIES_SEARCH_INDEX}
      leftSidebar={
        <SearchLayout.Filters>
          <RenderFilters />
        </SearchLayout.Filters>
      }
    >
      {page}
    </SearchLayout>
  );
};
