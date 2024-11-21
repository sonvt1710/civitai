import { supportUsImageSizes } from '~/components/Ads/ads.utils';
import { Text } from '@mantine/core';
import React, { useEffect, useRef, useState } from 'react';
import { useAdsContext } from '~/components/Ads/AdsProvider';
import Image from 'next/image';
import { NextLink } from '@mantine/next';
import { useBrowsingLevelDebounced } from '~/components/BrowsingLevel/BrowsingLevelProvider';
import { getIsSafeBrowsingLevel } from '~/shared/constants/browsingLevel.constants';
import { getRandomId } from '~/utils/string-helpers';
import clsx from 'clsx';
import { useIsomorphicLayoutEffect } from '~/hooks/useIsomorphicLayoutEffect';

// export function AdUnit({
//   keys,
//   withFeedback,
//   children,
//   className,
//   style,
//   justify,
//   browsingLevel: browsingLevelOverride,
//   ...props
// }: React.HTMLAttributes<HTMLDivElement> & {
//   keys: AdUnitKey[];
//   withFeedback?: boolean;
//   justify?: 'start' | 'end' | 'center';
//   browsingLevel?: number;
// }) {
//   const { adsEnabled } = useAdsContext();
//   const ref = useRef<HTMLDivElement | null>(null);
//   const details = getAdUnitDetails(keys);
//   const [width, setWidth] = useState<number>();
//   const item = useMemo(
//     () =>
//       width
//         ? details.find((x) => {
//             // don't change this logic without consulting Briant
//             return x.width <= width;
//           })
//         : undefined,
//     [keys.join(','), width]
//   );
//   const debouncer = useDebouncer(300);
//   const prevWidthRef = useRef<number | null>(null);
//   const browsingLevel = useBrowsingLevelDebounced();
//   const nsfw = !getIsSafeBrowsingLevel(browsingLevelOverride ?? browsingLevel);

//   useIsomorphicLayoutEffect(() => {
//     const node = ref.current?.parentElement ?? ref.current;
//     if (ref.current && node) {
//       setWidth(getClientWidth(node));
//       const resizeObserver = new ResizeObserver((entries) => {
//         const clientWidth = entries[0].contentBoxSize[0].inlineSize;
//         const widthChanged = prevWidthRef.current !== clientWidth;
//         if (!widthChanged) return;

//         prevWidthRef.current = clientWidth;
//         debouncer(() => setWidth(clientWidth));
//       });

//       resizeObserver.observe(node);
//       return () => {
//         resizeObserver.disconnect();
//       };
//     }
//   }, [nsfw]);

//   if (!adsEnabled || nsfw) return null;

//   return (
//     <div
//       className={clsx(
//         'flex w-full max-w-full',
//         {
//           ['justify-start']: justify === 'start',
//           ['justify-center']: justify === 'center',
//           ['justify-end']: justify === 'end',
//         },
//         className
//       )}
//       ref={ref}
//       style={!item ? { display: 'none', ...style } : style}
//       {...props}
//     >
//       {item && (
//         <AdUnitContext.Provider value={{ item, withFeedback }}>
//           {children ?? <AdUnitContent />}
//         </AdUnitContext.Provider>
//       )}
//     </div>
//   );
// }

// function getClientWidth(node: HTMLElement) {
//   if (node.style.display !== 'none') return node.clientWidth;
//   else {
//     node.style.removeProperty('display');
//     const clientWidth = node.clientWidth;
//     node.style.setProperty('display', 'none');
//     return clientWidth;
//   }
// }

// const AdWrapper = ({ children, className, width, height, style, ...props }: AdWrapperProps) => {
//   const node = useScrollAreaRef();
//   const currentUser = useCurrentUser();
//   const isClient = useIsClient();
//   const [visible, setVisible] = useState(false);
//   const { adsBlocked, isMember } = useAdsContext();
//   const isMobile = isMobileDevice();
//   const { withFeedback } = useAdUnitContext();
//   const { item } = useAdUnitContext();
//   // const focused = useIsLevelFocused();

//   const { ref, inView } = useInView({ root: node?.current, rootMargin: '75% 0px' });
//   useEffect(() => {
//     if (inView && !visible) {
//       setVisible(true);
//     }
//   }, [inView]);

//   return (
//     <div
//       ref={ref}
//       className={clsx('flex flex-col items-center justify-between', className)}
//       style={{
//         ...style,
//         minHeight: height ? height + (withFeedback ? 20 : 0) : undefined,
//         // don't change this logic without consulting Briant
//         // width - 1 allows the parent AdUnit to remove this content when its parent width is too small
//         minWidth: width ? width - 1 : undefined,
//       }}
//       {...props}
//     >
//       {isClient && adsBlocked !== undefined && height && width && (
//         <>
//           {adsBlocked ? (
//             <NextLink href="/pricing" className="flex">
//               <Image
//                 src={`/images/support-us/${width}x${height}.jpg`}
//                 alt="Please support civitai and creators by disabling adblock"
//                 width={width}
//                 height={height}
//               />
//             </NextLink>
//           ) : (
//             <div className="w-full overflow-hidden" key={item.id}>
//               {visible && (typeof children === 'function' ? children({ isMobile }) : children)}
//             </div>
//           )}

//           {withFeedback && (
//             <>
//               <div className="flex w-full justify-between">
//                 {!isMember ? (
//                   <Text
//                     component={NextLink}
//                     td="underline"
//                     href="/pricing"
//                     color="dimmed"
//                     size="xs"
//                     align="center"
//                   >
//                     Remove ads
//                   </Text>
//                 ) : (
//                   <div />
//                 )}

//                 {currentUser && (
//                   <Text
//                     component={NextLink}
//                     td="underline"
//                     href={`/ad-feedback?Username=${currentUser.username}`}
//                     color="dimmed"
//                     size="xs"
//                     align="center"
//                   >
//                     Feedback
//                   </Text>
//                 )}
//               </div>
//             </>
//           )}
//         </>
//       )}
//     </div>
//   );
// };

type AdSize = [width: number, height: number];
type ContainerSize = [minWidth?: number, maxWidth?: number];
type AdSizeLUT = [containerSize: ContainerSize, adSizes: AdSize[]];

const adUnitDictionary: Record<string, string> = {};

function AdUnitContent({
  adUnit,
  sizes,
  lazyLoad,
}: {
  adUnit: string;
  sizes?: AdSize[];
  lazyLoad?: boolean;
}) {
  const loadedRef = useRef(false);
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const id = getRandomId();
    setId(id);

    if (!adUnitDictionary[adUnit]) adUnitDictionary[adUnit] = id;

    if (window.adngin && window.adngin.adnginLoaderReady) {
      window.adngin.queue.push(() => {
        const payload = {
          adUnit,
          placement: id,
          gpIdUniquifier: adUnitDictionary[adUnit],
          lazyLoad,
          sizes,
        };
        window.adngin.cmd.startAuction([payload]);
      });
    }
  }, []);

  return id ? <div className="flex items-center justify-center" id={id}></div> : null;
}

export function AdUnitRenderable({
  browsingLevel: browsingLevelOverride,
  children,
}: {
  browsingLevel?: number;
  children?: React.ReactElement;
}) {
  const { adsEnabled } = useAdsContext();
  const browsingLevel = useBrowsingLevelDebounced();
  const nsfw = !getIsSafeBrowsingLevel(browsingLevelOverride ?? browsingLevel);

  if (!adsEnabled || nsfw) return null;
  return children ?? null;
}

function SupportUsImage({ maxHeight = 0 }: { maxHeight?: number }) {
  const filtered = supportUsImageSizes
    .filter(([, height]) => height <= maxHeight)
    .sort(([, a], [, b]) => b - a);
  const match = filtered[0];
  if (!match) return null;
  const [width, height] = match;
  return (
    <NextLink href="/pricing" className="flex">
      <Image
        src={`/images/support-us/${width}x${height}.jpg`}
        alt="Please support civitai and creators by disabling adblock"
        width={width}
        height={height}
      />
    </NextLink>
  );
}

function AdWrapper({
  adUnit,
  sizes,
  lutSizes,
  withFeedback,
  lazyLoad,
  className,
}: {
  adUnit: string;
  sizes?: AdSize[];
  lutSizes?: AdSizeLUT[];
  withFeedback?: boolean;
  lazyLoad?: boolean;
  className?: string;
}) {
  const { adsBlocked, ready, isMember } = useAdsContext();
  const adSizes = sizes ?? getAdSizesFromLUT(lutSizes);
  const [maxHeight, setMaxHeight] = useState<number | undefined>();

  useIsomorphicLayoutEffect(() => {
    setMaxHeight(adSizes ? getMaxHeight(adSizes) : undefined);
  }, []);

  return (
    <div
      className={clsx('relative flex flex-col items-center justify-center gap-2', className)}
      style={{ minHeight: maxHeight }}
      suppressHydrationWarning
    >
      {adsBlocked ? (
        <SupportUsImage maxHeight={maxHeight} />
      ) : ready ? (
        <AdUnitContent adUnit={adUnit} sizes={adSizes} lazyLoad={lazyLoad} />
      ) : null}
      {withFeedback && !isMember && (
        <>
          <div className="flex w-full justify-end">
            <Text
              component={NextLink}
              td="underline"
              href="/pricing"
              color="dimmed"
              size="xs"
              align="center"
            >
              Remove ads
            </Text>
          </div>
        </>
      )}
    </div>
  );
}

function adUnitFactory(factoryArgs: { adUnit: string; sizes?: AdSize[]; lutSizes?: AdSizeLUT[] }) {
  return function AdUnit({
    lazyLoad,
    withFeedback,
    browsingLevel,
    className,
  }: {
    lazyLoad?: boolean;
    withFeedback?: boolean;
    browsingLevel?: number;
    className?: string;
  }) {
    return (
      <AdUnitRenderable browsingLevel={browsingLevel}>
        <AdWrapper
          {...factoryArgs}
          lazyLoad={lazyLoad}
          withFeedback={withFeedback}
          className={className}
        />
      </AdUnitRenderable>
    );
  };
}

function getAdSizesFromLUT(lut?: AdSizeLUT[]) {
  // if ad sizes become problematic due to our containerized app layout, we can convert this to a hook and pull in container refs
  if (typeof window === 'undefined') return;
  return lut
    ?.filter(([[minWidth, maxWidth]]) => {
      if (minWidth && window.innerWidth < minWidth) return false;
      if (maxWidth && window.innerWidth > maxWidth) return false;
      return true;
    })
    .flatMap(([_, sizes]) => sizes);
}

function getMaxHeight(sizes: AdSize[]) {
  return Math.max(...sizes.map(([_, height]) => Math.max(height)));
}

export const AdUnitIncontent_1 = adUnitFactory({
  adUnit: 'incontent_1',
  sizes: [
    [320, 100],
    [320, 50],
    [300, 250],
    [300, 100],
    [300, 50],
    // [336, 280],
  ],
});

/** max dimensions: 300x600 */
export const AdUnitSide_1 = adUnitFactory({
  adUnit: 'side_1',
  lutSizes: [
    [
      [1050, 1199],
      [
        [120, 600],
        [160, 600],
      ],
    ],
    [
      [1200],
      [
        [120, 600],
        [160, 600],
        [300, 600],
        [300, 250],
        [336, 280],
      ],
    ],
  ],
});

/** max dimensions: 336x280  */
export const AdUnitSide_2 = adUnitFactory({
  adUnit: 'side_2',
  lutSizes: [
    [
      [1200],
      [
        [200, 200],
        [250, 250],
        [300, 250],
        [336, 280],
      ],
    ],
  ],
});

/** max dimensions: 336x280  */
export const AdUnitSide_3 = adUnitFactory({
  adUnit: 'side_3',
  sizes: [
    [200, 200],
    [250, 250],
    [300, 250],
    [336, 280],
  ],
});

export const AdUnitOutstream = adUnitFactory({ adUnit: 'outstream' });

export const AdUnitTop = adUnitFactory({
  adUnit: 'top',
  lutSizes: [
    [
      [0, 759],
      [
        [320, 100],
        [320, 50],
        [300, 250],
        [300, 100],
        [300, 50],
        [336, 280],
      ],
    ],
    [
      [760, 1023],
      [
        [468, 60],
        [728, 90],
      ],
    ],
    [
      [1024],
      [
        [728, 90],
        [970, 90],
        [970, 250],
        [980, 90],
      ],
    ],
  ],
});
