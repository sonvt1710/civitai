import {
  ProfileSection,
  ProfileSectionPreview,
  ProfileSectionProps,
  useProfileSectionStyles,
} from '~/components/Profile/ProfileSection';
import { useInView } from 'react-intersection-observer';
import { IconHeart } from '@tabler/icons-react';
import React, { useMemo } from 'react';
import { ShowcaseItemSchema } from '~/server/schema/user-profile.schema';
import { trpc } from '~/utils/trpc';
import { GenericImageCard } from '~/components/Cards/GenericImageCard';
import { useHiddenPreferencesContext } from '~/providers/HiddenPreferencesProvider';
import { applyUserPreferencesImages } from '~/components/Search/search.utils';
import { useCurrentUser } from '~/hooks/useCurrentUser';

export const ShowcaseSection = ({ user }: ProfileSectionProps) => {
  const { ref, inView } = useInView({
    delay: 100,
    triggerOnce: true,
  });
  const showcaseItems = user.profile.showcaseItems as ShowcaseItemSchema[];
  const currentUser = useCurrentUser();
  const {
    data: _coverImages = [],
    isLoading,
    isRefetching,
  } = trpc.image.getEntitiesCoverImage.useQuery(
    {
      entities: showcaseItems,
    },
    {
      enabled: showcaseItems.length > 0 && inView,
      keepPreviousData: true,
    }
  );
  const {
    users: hiddenUsers,
    images: hiddenImages,
    tags: hiddenTags,
    isLoading: loadingPreferences,
  } = useHiddenPreferencesContext();

  const coverImages: typeof _coverImages = useMemo(() => {
    if (loadingPreferences) {
      return [];
    }

    return applyUserPreferencesImages<(typeof _coverImages)[number]>({
      items: _coverImages,
      currentUserId: currentUser?.id,
      hiddenUsers,
      hiddenImages,
      hiddenTags,
    });
  }, [_coverImages]);

  const { classes, cx } = useProfileSectionStyles({
    // count: coverImages.length,
    count: showcaseItems.length,
    rowCount: 2,
    widthGrid: '280px',
  });

  const isNullState = showcaseItems.length === 0 || (!isLoading && !coverImages.length);

  if (isNullState && inView) {
    return null;
  }

  return (
    <div ref={ref} className={isNullState ? undefined : classes.profileSection}>
      {isLoading || !inView ? (
        <ProfileSectionPreview rowCount={2} />
      ) : (
        <ProfileSection title="Showcase" icon={<IconHeart />}>
          <div
            className={cx({
              [classes.grid]: coverImages.length > 0,
              [classes.nullState]: !coverImages.length,
              [classes.loading]: isRefetching,
            })}
          >
            {coverImages.map((image) => (
              <GenericImageCard
                image={image}
                entityId={image.entityId}
                entityType={image.entityType}
                key={`${image.entityType}-${image.entityId}`}
              />
            ))}
          </div>
        </ProfileSection>
      )}
    </div>
  );
};
