import {
  Group,
  Text,
  Stack,
  Popover,
  ActionIcon,
  Checkbox,
  Button,
  Tooltip,
  Anchor,
} from '@mantine/core';
import { NextLink as Link } from '~/components/NextLink/NextLink';
import type { IconProps } from '@tabler/icons-react';
import { IconAlertTriangle, IconEyeExclamation, IconSword } from '@tabler/icons-react';
import { BrowsingLevelsGrouped } from '~/components/BrowsingLevel/BrowsingLevelsGrouped';
import { openHiddenTagsModal } from '~/components/Dialog/dialog-registry';
import { useBrowsingSettings } from '~/providers/BrowserSettingsProvider';
import { constants } from '~/server/common/constants';
import { useBrowsingSettingsAddons } from '~/providers/BrowsingSettingsAddonsProvider';
import { useFeatureFlags } from '~/providers/FeatureFlagsProvider';

export function BrowsingModeIcon({ iconProps = {} }: BrowsingModeIconProps) {
  return (
    <Popover zIndex={constants.imageGeneration.drawerZIndex + 1} withArrow withinPortal>
      <Popover.Target>
        <ActionIcon>
          <IconEyeExclamation {...iconProps} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown p="md">
        <BrowsingModeMenu />
      </Popover.Dropdown>
    </Popover>
  );
}
type BrowsingModeIconProps = {
  iconProps?: IconProps;
  closeMenu?: () => void;
};

export function BrowsingModeMenu({ closeMenu }: { closeMenu?: () => void }) {
  const showNsfw = useBrowsingSettings((x) => x.showNsfw);
  const blurNsfw = useBrowsingSettings((x) => x.blurNsfw);
  const disableHidden = useBrowsingSettings((x) => x.disableHidden);
  const setState = useBrowsingSettings((x) => x.setState);
  const browsingSettingsAddons = useBrowsingSettingsAddons();
  const features = useFeatureFlags();

  const toggleBlurNsfw = () => setState((state) => ({ blurNsfw: !state.blurNsfw }));
  const toggleDisableHidden = () => setState((state) => ({ disableHidden: !state.disableHidden }));

  return (
    <div id="browsing-mode">
      <Stack spacing="md" className="sm:min-w-96">
        {showNsfw && (
          <Stack spacing="lg">
            <Stack spacing={4}>
              <Stack spacing={0}>
                <Group align="flex-start">
                  <Text sx={{ lineHeight: 1 }}>Browsing Level</Text>
                  {showNsfw && features.newOrderGame && (
                    <Tooltip label="Help us improve by playing!" withArrow color="dark">
                      <Button
                        onClick={closeMenu}
                        component={Link}
                        href="/games/knights-of-new-order"
                        size="xs"
                        ml="auto"
                        variant="outline"
                        color="orange.5"
                        compact
                      >
                        <Group spacing={4}>
                          Join the Knights Order
                          <IconSword size={14} />
                        </Group>
                      </Button>
                    </Tooltip>
                  )}
                </Group>
                <Text color="dimmed">Select the levels of content you want to see</Text>
              </Stack>
              <BrowsingLevelsGrouped />
              {browsingSettingsAddons.settings.disablePoi && (
                <Group spacing="sm" mt={4}>
                  <IconAlertTriangle size={16} />
                  <Text color="dimmed" size="xs">
                    With X or XXX enabled, some content may be hidden.{' '}
                    <Anchor href="/articles/13632">Learn more</Anchor>
                  </Text>
                </Group>
              )}
            </Stack>
            <Checkbox
              checked={blurNsfw}
              onChange={toggleBlurNsfw}
              label="Blur mature content (R+)"
              size="md"
            />
          </Stack>
        )}

        <Group position="apart">
          <Checkbox
            checked={!disableHidden}
            onChange={toggleDisableHidden}
            label={
              <Text>
                Apply{' '}
                <Text
                  component="span"
                  variant="link"
                  underline
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openHiddenTagsModal();
                  }}
                >
                  my filters
                </Text>
              </Text>
            }
            size="md"
          />
        </Group>
      </Stack>
    </div>
  );
}
