import type { ButtonProps, PopoverProps } from '@mantine/core';
import { Divider, Indicator, Popover, ScrollArea, Stack } from '@mantine/core';
import { IconFilter } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { FilterButton } from '~/components/Buttons/FilterButton';
import { FilterChip } from '~/components/Filters/FilterChip';
import { IsClient } from '~/components/IsClient/IsClient';
import type { GenerationFilterSchema } from '~/providers/FiltersProvider';
import { useFiltersContext } from '~/providers/FiltersProvider';
import { GenerationReactType } from '~/server/common/enums';
import { WORKFLOW_TAGS } from '~/shared/constants/generation.constants';
import { titleCase } from '~/utils/string-helpers';

const tagGroups = {};

export function MarkerFiltersDropdown(props: Props) {
  const { filters, setFilters } = useFiltersContext((state) => ({
    filters: state.generation,
    setFilters: state.setGenerationFilters,
  }));

  return <DumbMarkerFiltersDropdown {...props} filters={filters} setFilters={setFilters} />;
}

export function DumbMarkerFiltersDropdown({
  filters,
  setFilters,
  filterMode = 'local',
  position = 'bottom-start',
  isFeed,
  text,
  hideMediaTypes = false,
  ...buttonProps
}: Props & {
  filters: Partial<GenerationFilterSchema>;
  setFilters: (filters: Partial<GenerationFilterSchema>) => void;
}) {
  const [opened, setOpened] = useState(false);

  const [currentMarker, setMarker] = useState<GenerationReactType | undefined>(filters.marker);

  if (filters.marker !== currentMarker) {
    setMarker(filters.marker);
  }

  let filterLength = 0;
  if (filters.marker) filterLength += 1;
  if (filters.tags) filterLength += filters.tags.length;

  return (
    <IsClient>
      <Popover
        zIndex={300}
        position={position}
        shadow="md"
        onClose={() => setOpened(false)}
        withinPortal
      >
        <Indicator
          offset={4}
          label={filterLength ? filterLength : undefined}
          size={14}
          zIndex={10}
          disabled={!filterLength}
          inline
        >
          <Popover.Target>
            <FilterButton icon={IconFilter} active={opened} onClick={() => setOpened((o) => !o)}>
              Filters
            </FilterButton>
          </Popover.Target>
        </Indicator>
        <Popover.Dropdown maw={576} w="100%">
          <ScrollArea.Autosize mah={'calc(90vh - var(--header-height) - 56px)'} type="hover">
            <Stack gap={8}>
              {!hideMediaTypes && (
                <>
                  <Divider label="Generation Type" className="text-sm font-bold" />
                  <div className="flex gap-2">
                    <FilterChip
                      checked={!filters.tags?.length}
                      onChange={() => setFilters({ tags: [] })}
                    >
                      All
                    </FilterChip>
                    <FilterChip
                      checked={filters.tags?.includes(WORKFLOW_TAGS.IMAGE) ?? false}
                      onChange={() => setFilters({ tags: [WORKFLOW_TAGS.IMAGE] })}
                    >
                      Images
                    </FilterChip>
                    <FilterChip
                      checked={filters.tags?.includes(WORKFLOW_TAGS.VIDEO) ?? false}
                      onChange={() => setFilters({ tags: [WORKFLOW_TAGS.VIDEO] })}
                    >
                      Videos
                    </FilterChip>
                  </div>
                </>
              )}
              <Divider label="Reactions" className="text-sm font-bold" />
              <div className="flex gap-2">
                {Object.values(GenerationReactType).map((marker) => {
                  return (
                    <FilterChip
                      key={marker}
                      checked={marker === filters.marker}
                      onChange={(checked) => {
                        setMarker(checked ? marker : undefined);
                        setFilters({ marker: checked ? marker : undefined });
                      }}
                    >
                      <span>{titleCase(marker)}</span>
                    </FilterChip>
                  );
                })}
              </div>
            </Stack>
          </ScrollArea.Autosize>
        </Popover.Dropdown>
      </Popover>
    </IsClient>
  );
}

type Props = Omit<ButtonProps, 'onClick' | 'children' | 'rightIcon'> & {
  filterMode?: 'local' | 'query';
  position?: PopoverProps['position'];
  isFeed?: boolean;
  text?: ReactNode;
  hideMediaTypes?: boolean;
};
