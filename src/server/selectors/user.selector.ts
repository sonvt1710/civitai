import { Prisma } from '@prisma/client';
import { imageSelect } from '~/server/selectors/image.selector';

export const simpleUserSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  username: true,
  deletedAt: true,
  image: true,
});

const simpleUser = Prisma.validator<Prisma.UserArgs>()({
  select: simpleUserSelect,
});

export type SimpleUser = Prisma.UserGetPayload<typeof simpleUser>;

export const userWithCosmeticsSelect = Prisma.validator<Prisma.UserSelect>()({
  ...simpleUserSelect,
  // TODO.leaderboard: uncomment when migration is done
  // leaderboardShowcase: true,
  cosmetics: {
    where: { equippedAt: { not: null } },
    select: {
      cosmetic: {
        select: {
          id: true,
          data: true,
          type: true,
          source: true,
          name: true,
        },
      },
    },
  },
});

const userWithCosmetics = Prisma.validator<Prisma.UserArgs>()({
  select: userWithCosmeticsSelect,
});

export type UserWithCosmetics = Prisma.UserGetPayload<typeof userWithCosmetics>;

export const userWithProfileSelect = Prisma.validator<Prisma.UserSelect>()({
  ...simpleUserSelect,
  leaderboardShowcase: true,
  createdAt: true,
  muted: true,
  cosmetics: {
    select: {
      equippedAt: true,
      cosmeticId: true,
      obtainedAt: true,
      cosmetic: {
        select: {
          id: true,
          data: true,
          type: true,
          source: true,
          name: true,
          description: true,
        },
      },
    },
  },
  links: {
    select: {
      id: true,
      url: true,
      type: true,
    },
  },
  rank: {
    select: {
      leaderboardRank: true,
      leaderboardId: true,
      leaderboardTitle: true,
      leaderboardCosmetic: true,
    },
  },
  stats: {
    select: {
      ratingAllTime: true,
      ratingCountAllTime: true,
      downloadCountAllTime: true,
      favoriteCountAllTime: true,
      followerCountAllTime: true,
    },
  },
  profile: {
    select: {
      bio: true,
      coverImageId: true,
      coverImage: {
        select: imageSelect,
      },
      message: true,
      messageAddedAt: true,
      profileSectionsSettings: true,
      privacySettings: true,
      showcaseItems: true,
      location: true,
      nsfw: true,
      userId: true,
    },
  },
});
