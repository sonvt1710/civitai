import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  MantineSize,
  Popover,
  Stack,
  Text,
  useMantineTheme,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconDotsVertical,
  IconMapPin,
  IconPencilMinus,
  IconRss,
  IconShare3,
} from '@tabler/icons-react';

import { RankBadge } from '~/components/Leaderboard/RankBadge';
import { ContentClamp } from '~/components/ContentClamp/ContentClamp';
import { sortDomainLinks } from '~/utils/domain-link';
import { DomainIcon } from '~/components/DomainIcon/DomainIcon';
import { FollowUserButton } from '~/components/FollowUserButton/FollowUserButton';
import { UserStats } from '~/components/Profile/UserStats';
import { TipBuzzButton } from '~/components/Buzz/TipBuzzButton';
import { EdgeMedia } from '~/components/EdgeMedia/EdgeMedia';
import { formatDate } from '~/utils/date-helpers';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { trpc } from '~/utils/trpc';
import React, { useMemo, useState } from 'react';
import { UserAvatar } from '~/components/UserAvatar/UserAvatar';
import { openUserProfileEditModal } from '~/components/Modals/UserProfileEditModal';
import { CollectionType, CosmeticType } from '@prisma/client';
import { Username } from '~/components/User/Username';
import { useIsMobile } from '~/hooks/useIsMobile';
import { UserContextMenu } from '~/components/Profile/old/OldProfileLayout';
import { AlertWithIcon } from '../AlertWithIcon/AlertWithIcon';
import { ShareButton } from '~/components/ShareButton/ShareButton';
import { useRouter } from 'next/router';

const mapSize: Record<
  'mobile' | 'desktop',
  {
    avatar: number;
    username: MantineSize;
    text: MantineSize;
    spacing: MantineSize | number;
    button: MantineSize;
    rankBadge: MantineSize;
    icons: number;
    badges: number;
    bio: number;
    badgeCount: number;
  }
> = {
  mobile: {
    avatar: 72,
    icons: 24,
    username: 'sm',
    text: 'sm',
    spacing: 4,
    button: 'sm',
    rankBadge: 'md',
    badges: 40,
    bio: 24,
    badgeCount: 7,
  },
  desktop: {
    avatar: 144,
    icons: 24,
    username: 'xl',
    text: 'md',
    spacing: 'md',
    button: 'md',
    rankBadge: 'xl',
    badges: 56,
    bio: 48,
    badgeCount: 4,
  },
};

export function ProfileSidebar({ username, className }: { username: string; className?: string }) {
  const router = useRouter();
  const theme = useMantineTheme();
  const isMobile = useIsMobile({ breakpoint: 'sm' });
  const currentUser = useCurrentUser();
  const { data: user } = trpc.userProfile.get.useQuery({
    username,
  });
  const isCurrentUser = currentUser?.id === user?.id;
  const muted = !!user?.muted;
  const [showAllBadges, setShowAllBadges] = useState<boolean>(false);
  const sizeOpts = mapSize[isMobile ? 'mobile' : 'desktop'];

  const badges = useMemo(
    () =>
      !user
        ? []
        : user.cosmetics
            .map((c) => c.cosmetic)
            .filter((c) => c.type === CosmeticType.Badge && !!c.data),
    [user]
  );

  if (!user) {
    return null;
  }

  const { profile, stats } = user;
  const shouldDisplayStats = stats && !!Object.values(stats).find((stat) => stat !== 0);
  const equippedCosmetics = user?.cosmetics.filter((c) => !!c.equippedAt);
  const editProfileBtn = isCurrentUser && (
    <Button
      leftIcon={isMobile ? undefined : <IconPencilMinus size={16} />}
      size={sizeOpts.button}
      onClick={() => {
        openUserProfileEditModal({});
      }}
      sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}
      radius="xl"
      fullWidth
    >
      Edit profile
    </Button>
  );
  const followUserBtn = !isCurrentUser && (
    <FollowUserButton
      userId={user.id}
      leftIcon={isMobile ? undefined : <IconRss size={16} />}
      size={sizeOpts.button}
      sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}
      variant={isMobile ? 'filled' : undefined}
    />
  );

  const tipBuzzBtn = (
    <TipBuzzButton
      toUserId={user.id}
      size={sizeOpts.button}
      variant={isMobile ? 'filled' : 'light'}
      color="yellow.7"
      label="Tip"
      sx={{ fontSize: '14px', fontWeight: 590 }}
    />
  );
  const shareBtn = (
    <ShareButton url={router.asPath} title={`${user.username} Profile`}>
      <ActionIcon
        size={30}
        radius="xl"
        color="gray"
        variant={theme.colorScheme === 'dark' ? 'filled' : 'light'}
        ml="auto"
      >
        <IconShare3 size={16} />
      </ActionIcon>
    </ShareButton>
  );

  const mutedAlert = isCurrentUser && muted && (
    <AlertWithIcon icon={<IconAlertCircle />} iconSize="sm">
      You cannot edit your profile because your account has been muted
    </AlertWithIcon>
  );

  return (
    <Stack className={className} spacing={sizeOpts.spacing}>
      <Group noWrap position="apart">
        <Group align="flex-start" position="apart" w={!isMobile ? '100%' : undefined}>
          <UserAvatar
            avatarSize={sizeOpts.avatar}
            user={user}
            size={sizeOpts.username}
            radius="md"
          />

          {!isMobile && (
            <Group>
              {shareBtn}
              <UserContextMenu username={username} />
            </Group>
          )}
        </Group>
        {isMobile && (
          <Group noWrap spacing={4}>
            {muted ? mutedAlert : editProfileBtn}
            {followUserBtn}
            {tipBuzzBtn}
            {shareBtn}
            <UserContextMenu username={username} />
          </Group>
        )}
      </Group>
      <RankBadge rank={user.rank} size={sizeOpts.rankBadge} withTitle />
      <Stack spacing={0}>
        <Username {...user} cosmetics={equippedCosmetics} size="xl" />
        <Text color="dimmed" size="sm">
          Joined {formatDate(user.createdAt)}
        </Text>
      </Stack>

      {profile.location && !muted && (
        <Group spacing="sm" noWrap>
          <IconMapPin size={16} style={{ flexShrink: 0 }} />
          <Text color="dimmed" truncate size={sizeOpts.text}>
            {profile.location}
          </Text>
        </Group>
      )}
      {profile?.bio && !muted && (
        <ContentClamp maxHeight={sizeOpts.bio} style={{ wordWrap: 'break-word' }}>
          {profile.bio}
        </ContentClamp>
      )}
      {!muted && (
        <Group spacing={4}>
          {sortDomainLinks(user.links).map((link, index) => (
            <ActionIcon
              key={index}
              component="a"
              href={link.url}
              target="_blank"
              rel="nofollow noreferrer"
              size={24}
            >
              <DomainIcon domain={link.domain} size={sizeOpts.icons} />
            </ActionIcon>
          ))}
        </Group>
      )}
      {!isMobile && (
        <Group grow>
          {muted ? mutedAlert : editProfileBtn}
          {followUserBtn}
        </Group>
      )}

      <Divider my={sizeOpts.spacing} />

      {shouldDisplayStats && (
        <UserStats
          rating={{ value: stats.ratingAllTime, count: stats.ratingCountAllTime }}
          followers={stats.followerCountAllTime}
          favorites={stats.favoriteCountAllTime}
          downloads={stats.downloadCountAllTime}
        />
      )}

      {!isMobile && tipBuzzBtn}

      {(!isCurrentUser || shouldDisplayStats) && <Divider my={sizeOpts.spacing} />}

      {badges.length > 0 && (
        <Stack spacing={sizeOpts.spacing}>
          <Text size={sizeOpts.text} color="dimmed" weight={590}>
            Badges
          </Text>
          <Group spacing="xs">
            {(showAllBadges ? badges : badges.slice(0, sizeOpts.badgeCount)).map((award) => {
              const data = (award.data ?? {}) as { url?: string };
              const url = (data.url ?? '') as string;

              if (!url) {
                return null;
              }

              return (
                <Popover key={award.id} withArrow width={200} position="top">
                  <Popover.Target>
                    <Box style={{ cursor: 'pointer' }}>
                      <EdgeMedia src={url} width={sizeOpts.badges} />
                    </Box>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <Stack spacing={0}>
                      <Text size="sm" align="center" weight={500}>
                        {award.name}
                      </Text>
                    </Stack>
                  </Popover.Dropdown>
                </Popover>
              );
            })}
            {badges.length > sizeOpts.badgeCount && (
              <Button
                color="gray"
                variant="light"
                onClick={() => setShowAllBadges((prev) => !prev)}
                size="xs"
                sx={{ fontSize: 12, fontWeight: 600 }}
                fullWidth
              >
                {showAllBadges ? 'Show less' : `Show all (${badges.length})`}
              </Button>
            )}
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
