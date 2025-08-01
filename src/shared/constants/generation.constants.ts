import type { WorkflowStatus } from '@civitai/client';
import { Scheduler } from '@civitai/client';
import type { MantineColor } from '@mantine/core';
import type { BaseModelSetType, Sampler } from '~/server/common/constants';
import {
  baseModelSets,
  generation,
  generationConfig,
  getGenerationConfig,
  maxUpscaleSize,
  minDownscaleSize,
} from '~/server/common/constants';
import { modelIdEngineMap } from '~/server/orchestrator/generation/generation.config';
import type { GenerationLimits } from '~/server/schema/generation.schema';
import type { TextToImageParams } from '~/server/schema/orchestrator/textToImage.schema';
import type { GenerationResource } from '~/server/services/generation/generation.service';
import type { WorkflowDefinition } from '~/server/services/orchestrator/types';
import type { MediaType } from '~/shared/utils/prisma/enums';
import { ModelType } from '~/shared/utils/prisma/enums';
import { findClosestAspectRatio } from '~/utils/aspect-ratio-helpers';
import { getImageDimensions } from '~/utils/image-utils';
import { findClosest, getRatio } from '~/utils/number-helpers';

export const WORKFLOW_TAGS = {
  GENERATION: 'gen',
  IMAGE: 'img',
  VIDEO: 'vid',
  FAVORITE: 'favorite',
  FOLDER: 'folder',
  FEEDBACK: {
    LIKED: 'feedback:liked',
    DISLIKED: 'feedback:disliked',
  },
};

export const generationServiceCookie = {
  name: 'generation-token',
  maxAge: 3600,
};

export function getRoundedWidthHeight({ width, height }: { width: number; height: number }) {
  const maxWidth = width < maxUpscaleSize ? width : maxUpscaleSize;
  const maxHeight = height < maxUpscaleSize ? height : maxUpscaleSize;
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.ceil((width * ratio) / 64) * 64,
    height: Math.ceil((height * ratio) / 64) * 64,
  };
}

export async function getSourceImageFromUrl({ url, upscale }: { url: string; upscale?: boolean }) {
  return getImageDimensions(url).then(({ width, height }) => {
    let upscaleWidth: number | undefined;
    let upscaleHeight: number | undefined;
    if (upscale) {
      const upscaled = getRoundedWidthHeight({ width: width * 1.5, height: height * 1.5 });
      upscaleWidth = upscaled.width;
      upscaleHeight = upscaled.height;
    }
    return { url, upscaleWidth, upscaleHeight, ...getRoundedWidthHeight({ width, height }) };
  });
}

// #region [statuses]
export const generationStatusColors: Record<WorkflowStatus, MantineColor> = {
  unassigned: 'yellow',
  preparing: 'yellow',
  scheduled: 'yellow',
  processing: 'yellow',
  succeeded: 'green',
  failed: 'red',
  expired: 'gray',
  canceled: 'gray',
};

export const orchestratorRefundableStatuses: WorkflowStatus[] = ['failed', 'expired', 'canceled'];
export const orchestratorCompletedStatuses: WorkflowStatus[] = [
  ...orchestratorRefundableStatuses,
  'succeeded',
];
export const orchestratorPendingStatuses: WorkflowStatus[] = [
  'unassigned',
  'preparing',
  'scheduled',
];
// #endregion

// #region [injectable resources]
export type InjectableResource = {
  id: number;
  triggerWord?: string;
  triggerType?: 'negative' | 'positive';
  baseModelSetType?: BaseModelSetType;
  sanitize?: (params: TextToImageParams) => Partial<TextToImageParams>;
};

export const draftInjectableResources = [
  {
    id: 391999,
    baseModelSetType: 'SDXL',
    sanitize: () => ({
      steps: 8,
      cfgScale: 1,
      sampler: 'Euler',
    }),
  } as InjectableResource,
  {
    id: 424706,
    baseModelSetType: 'SD1',
    sanitize: () => ({
      steps: 6,
      cfgScale: 1,
      sampler: 'LCM',
    }),
  } as InjectableResource,
];

export const allInjectableResourceIds = [...draftInjectableResources].map((x) => x.id);

export function getInjectablResources(baseModelSetType: BaseModelSetType) {
  const isSdxl = getIsSdxl(baseModelSetType);
  let value = baseModelSetType;
  if (isSdxl) value = 'SDXL';
  return {
    draft: draftInjectableResources.find((x) => x.baseModelSetType === value),
  };
}
// #endregion

export const whatIfQueryOverrides = {
  prompt: '',
  negativePrompt: '',
  seed: null,
  // image: undefined,
  nsfw: false,
  cfgScale: generation.defaultValues.cfgScale,
  remixSimilarity: 1,
};

export const samplersToSchedulers = {
  'Euler a': Scheduler.EULER_A,
  Euler: Scheduler.EULER,
  LMS: Scheduler.LMS,
  Heun: Scheduler.HEUN,
  DPM2: Scheduler.DP_M2,
  'DPM2 a': Scheduler.DP_M2A,
  'DPM++ 2S a': Scheduler.DP_M2SA,
  'DPM++ 2M': Scheduler.DP_M2M,
  // 'DPM++ 2M SDE': 'DPM2MSDE',
  'DPM++ SDE': Scheduler.DPMSDE,
  'DPM fast': Scheduler.DPM_FAST,
  'DPM adaptive': Scheduler.DPM_ADAPTIVE,
  'LMS Karras': Scheduler.LMS_KARRAS,
  'DPM2 Karras': Scheduler.DP_M2KARRAS,
  'DPM2 a Karras': Scheduler.DP_M2AKARRAS,
  'DPM++ 2S a Karras': Scheduler.DP_M2SAKARRAS,
  'DPM++ 2M Karras': Scheduler.DP_M2MKARRAS,
  // 'DPM++ 2M SDE Karras': 'DPM2MSDEKarras',
  'DPM++ SDE Karras': Scheduler.DPMSDE_KARRAS,
  'DPM++ 3M SDE': Scheduler.DP_M3MSDE,
  // 'DPM++ 3M SDE Karras': 'DPM3MSDEKarras',
  // 'DPM++ 3M SDE Exponential': 'DPM3MSDEExponential',
  DDIM: Scheduler.DDIM,
  PLMS: Scheduler.PLMS,
  UniPC: Scheduler.UNI_PC,
  LCM: Scheduler.LCM,
  undefined: Scheduler.UNDEFINED,
} as const as Record<Sampler | 'undefined', Scheduler>;

export const generationSamplers = Object.keys(samplersToSchedulers) as Sampler[];

// !important - undefined maps to the same values as 'DPM++ 2M Karras'
export const samplersToComfySamplers: Record<
  Sampler | 'undefined',
  { sampler: string; scheduler: 'normal' | 'karras' | 'exponential' }
> = {
  'Euler a': { sampler: 'euler_ancestral', scheduler: 'normal' },
  Euler: { sampler: 'euler', scheduler: 'normal' },
  LMS: { sampler: 'lms', scheduler: 'normal' },
  Heun: { sampler: 'heun', scheduler: 'normal' },
  DPM2: { sampler: 'dpmpp_2', scheduler: 'normal' },
  'DPM2 a': { sampler: 'dpmpp_2_ancestral', scheduler: 'normal' },
  'DPM++ 2S a': { sampler: 'dpmpp_2s_ancestral', scheduler: 'normal' },
  'DPM++ 2M': { sampler: 'dpmpp_2m', scheduler: 'normal' },
  'DPM++ 2M SDE': { sampler: 'dpmpp_2m_sde', scheduler: 'normal' },
  'DPM++ SDE': { sampler: 'dpmpp_sde', scheduler: 'normal' },
  'DPM fast': { sampler: 'dpm_fast', scheduler: 'normal' },
  'DPM adaptive': { sampler: 'dpm_adaptive', scheduler: 'normal' },
  'LMS Karras': { sampler: 'lms', scheduler: 'karras' },
  'DPM2 Karras': { sampler: 'dpm_2', scheduler: 'karras' },
  'DPM2 a Karras': { sampler: 'dpm_2_ancestral', scheduler: 'karras' },
  'DPM++ 2S a Karras': { sampler: 'dpmpp_2s_ancestral', scheduler: 'karras' },
  'DPM++ 2M Karras': { sampler: 'dpmpp_2m', scheduler: 'karras' },
  'DPM++ 2M SDE Karras': { sampler: 'dpmpp_2m_sde', scheduler: 'karras' },
  'DPM++ SDE Karras': { sampler: 'dpmpp_sde', scheduler: 'karras' },
  'DPM++ 3M SDE': { sampler: 'dpmpp_3m_sde', scheduler: 'normal' },
  'DPM++ 3M SDE Karras': { sampler: 'dpmpp_3m_sde', scheduler: 'karras' },
  'DPM++ 3M SDE Exponential': { sampler: 'dpmpp_3m_sde', scheduler: 'exponential' },
  DDIM: { sampler: 'ddim', scheduler: 'normal' },
  PLMS: { sampler: 'plms', scheduler: 'normal' },
  UniPC: { sampler: 'uni_pc', scheduler: 'normal' },
  LCM: { sampler: 'lcm', scheduler: 'normal' },
  undefined: { sampler: 'dpmpp_2m', scheduler: 'karras' },
};

// #region [utils]
// some base models, such as SD1.5 can work with different base model set types

export function getBaseModelSetType(baseModel?: string, defaultType?: BaseModelSetType) {
  defaultType ??= 'SD1';
  if (!baseModel) return defaultType;
  return (Object.entries(baseModelSets).find(
    ([key, baseModelSet]) =>
      key === baseModel || (baseModelSet.baseModels as string[]).includes(baseModel)
  )?.[0] ?? defaultType) as BaseModelSetType;
}

export function getBaseModelSet(baseModel?: string) {
  const baseModelSetType = getBaseModelSetType(baseModel);
  return baseModelSets[baseModelSetType] ?? [];
}

export function getIsSdxl(baseModel?: string) {
  const baseModelSetType = getBaseModelSetType(baseModel);
  return (
    baseModelSetType === 'SDXL' ||
    baseModelSetType === 'Pony' ||
    baseModelSetType === 'SDXLDistilled' ||
    baseModelSetType === 'Illustrious' ||
    baseModelSetType === 'NoobAI'
  );
}

export function getIsHiDream(baseModel?: string) {
  const baseModelSetType = getBaseModelSetType(baseModel);
  return baseModelSetType === 'HiDream';
}

export function getIsFlux(baseModel?: string) {
  const baseModelSetType = getBaseModelSetType(baseModel);
  return baseModelSetType === 'Flux1';
}

export function getIsFluxStandard(modelId: number) {
  return modelId === fluxStandardModelId;
}

export function getIsSD3(baseModel?: string) {
  const baseModelSetType = getBaseModelSetType(baseModel);
  return baseModelSetType === 'SD3' || baseModelSetType === 'SD3_5M';
}

export function getBaseModelFromResources<T extends { modelType: ModelType; baseModel: string }>(
  resources: T[]
) {
  const checkpoint = resources.find((x) => x.modelType === 'Checkpoint');
  if (checkpoint) return getBaseModelSetType(checkpoint.baseModel);
  const resourceBaseModels = resources.map((x) => getBaseModelSetType(x.baseModel));
  // image base models
  if (resourceBaseModels.some((baseModel) => baseModel === 'Pony')) return 'Pony';
  else if (resourceBaseModels.some((baseModel) => baseModel === 'SDXL')) return 'SDXL';
  else if (resourceBaseModels.some((baseModel) => baseModel === 'Flux1')) return 'Flux1';
  else if (resourceBaseModels.some((baseModel) => baseModel === 'Illustrious'))
    return 'Illustrious';
  else if (resourceBaseModels.some((baseModel) => baseModel === 'NoobAI')) return 'NoobAI';
  // else if (resourceBaseModels.some((baseModel) => baseModel === 'SD3')) return 'SD3';
  // else if (resourceBaseModels.some((baseModel) => baseModel === 'SD3_5M')) return 'SD3_5M';
  else if (resourceBaseModels.some((baseModel) => baseModel === 'OpenAI')) return 'OpenAI';
  else if (resourceBaseModels.some((baseModel) => baseModel === 'Imagen4')) return 'Imagen4';
  else if (resourceBaseModels.some((baseModel) => baseModel === 'Flux1Kontext'))
    return 'Flux1Kontext';
  else if (resourceBaseModels.some((baseModel) => baseModel === 'HiDream')) return 'HiDream';
  else if (resourceBaseModels.some((baseModel) => baseModel === 'SD1')) return 'SD1';
  // video base models
  for (const baseModelSet of videoBaseModelSetTypes) {
    if (resources.some((x) => getBaseModelSetType(x.baseModel) === baseModelSet))
      return baseModelSet;
  }
}

export function getBaseModelFromResourcesWithDefault<
  T extends { modelType: ModelType; baseModel: string }
>(resources: T[]) {
  return getBaseModelFromResources(resources) ?? 'SD1';
}

const videoBaseModelSetTypes: BaseModelSetType[] = [
  'HyV1',
  'WanVideo',
  'WanVideo14B_I2V_480p',
  'WanVideo14B_I2V_720p',
  'WanVideo14B_T2V',
  'WanVideo1_3B_T2V',
  'LTXV',
];
export function getResourceGenerationType(
  baseModel: ReturnType<typeof getBaseModelFromResourcesWithDefault>,
  resources: GenerationResource[]
) {
  if (resources.some((r) => modelIdEngineMap.get(r.model.id))) return 'video';
  return videoBaseModelSetTypes.includes(baseModel) ? 'video' : ('image' as MediaType);
}

export function sanitizeTextToImageParams<T extends Partial<TextToImageParams>>(
  params: T,
  limits?: GenerationLimits
) {
  // if (params.sampler) {
  //   params.sampler = (generation.samplers as string[]).includes(params.sampler)
  //     ? params.sampler
  //     : generation.defaultValues.sampler;
  // }

  const maxValueKeys = Object.keys(generation.maxValues);
  for (const item of maxValueKeys) {
    const key = item as keyof typeof generation.maxValues;
    if (params[key]) params[key] = Math.min(params[key] ?? 0, generation.maxValues[key]);
  }

  if (!params.aspectRatio && params.width && params.height) {
    params.aspectRatio = getClosestAspectRatio(params.width, params.height, params.baseModel);
    if (getIsFlux(params.baseModel))
      params.fluxUltraAspectRatio = getClosestFluxUltraAspectRatio(params.width, params.height);
  }

  // handle SDXL ClipSkip
  // I was made aware that SDXL only works with clipSkip 2
  // if that's not the case anymore, we can rollback to just setting
  // this for Pony resources -Manuel
  const isSDXL = getIsSdxl(params.baseModel);
  if (isSDXL) params.clipSkip = 2;

  if (limits) {
    if (params.steps) params.steps = Math.min(params.steps, limits.steps);
    if (params.quantity) params.quantity = Math.min(params.quantity, limits.quantity);
  }
  return params;
}

export function getSizeFromAspectRatio(aspectRatio: string, baseModel?: string) {
  const aspectRatios = getGenerationConfig(baseModel).aspectRatios;
  return (
    aspectRatios.find((x) => getRatio(x.width, x.height) === aspectRatio) ??
    generationConfig.SD1.aspectRatios[0]
  );
}

export const getClosestAspectRatio = (width?: number, height?: number, baseModel?: string) => {
  width = width ?? (baseModel === 'SDXL' ? 1024 : 512);
  height = height ?? (baseModel === 'SDXL' ? 1024 : 512);
  const aspectRatios = getGenerationConfig(baseModel).aspectRatios;
  const result = findClosestAspectRatio({ width, height }, aspectRatios) ?? aspectRatios[0];
  return result ? getRatio(result.width, result.height) : '1:1';
};

export function getWorkflowDefinitionFeatures(workflow?: {
  features?: WorkflowDefinition['features'];
}) {
  return {
    draft: workflow?.features?.includes('draft') ?? false,
    denoise: workflow?.features?.includes('denoise') ?? false,
    upscaleWidth: workflow?.features?.includes('upscale') ?? false,
    upscaleHeight: workflow?.features?.includes('upscale') ?? false,
    image: workflow?.features?.includes('image') ?? false,
  };
}

export function sanitizeParamsByWorkflowDefinition(
  params: TextToImageParams,
  workflow?: {
    features?: WorkflowDefinition['features'];
  }
) {
  const features = getWorkflowDefinitionFeatures(workflow);
  for (const key in features) {
    if (!features[key as keyof typeof features]) delete (params as any)[key];
  }
}

// #endregion

// #region [config]
const sdxlEcosystemPartialSupport = [
  'SDXL 0.9',
  'SDXL 1.0',
  'SDXL 1.0 LCM',
  ...baseModelSets.Pony.baseModels,
  ...baseModelSets.Illustrious.baseModels,
  ...baseModelSets.NoobAI.baseModels,
];
export type BaseModelResourceTypes = typeof baseModelResourceTypes;
export type SupportedBaseModel = keyof BaseModelResourceTypes;
export const baseModelResourceTypes = {
  SD1: [
    { type: ModelType.Checkpoint, baseModels: [...baseModelSets.SD1.baseModels] },
    { type: ModelType.TextualInversion, baseModels: [...baseModelSets.SD1.baseModels] },
    { type: ModelType.LORA, baseModels: [...baseModelSets.SD1.baseModels] },
    { type: ModelType.DoRA, baseModels: [...baseModelSets.SD1.baseModels] },
    { type: ModelType.LoCon, baseModels: [...baseModelSets.SD1.baseModels] },
    { type: ModelType.VAE, baseModels: [...baseModelSets.SD1.baseModels] },
  ],
  SDXL: [
    { type: ModelType.Checkpoint, baseModels: [...baseModelSets.SDXL.baseModels] },
    {
      type: ModelType.TextualInversion,
      baseModels: [...baseModelSets.SDXL.baseModels],
      partialSupport: [
        'SD 1.5',
        ...baseModelSets.Pony.baseModels,
        ...baseModelSets.Illustrious.baseModels,
      ],
    },
    {
      type: ModelType.LORA,
      baseModels: [...baseModelSets.SDXL.baseModels],
      partialSupport: [...baseModelSets.Pony.baseModels, ...baseModelSets.Illustrious.baseModels],
    },
    {
      type: ModelType.DoRA,
      baseModels: [...baseModelSets.SDXL.baseModels],
      partialSupport: [...baseModelSets.Pony.baseModels, ...baseModelSets.Illustrious.baseModels],
    },
    {
      type: ModelType.LoCon,
      baseModels: [...baseModelSets.SDXL.baseModels],
      partialSupport: [...baseModelSets.Pony.baseModels, ...baseModelSets.Illustrious.baseModels],
    },
    {
      type: ModelType.VAE,
      baseModels: [...baseModelSets.SDXL.baseModels],
      partialSupport: [...baseModelSets.Pony.baseModels, ...baseModelSets.Illustrious.baseModels],
    },
  ],
  Pony: [
    { type: ModelType.Checkpoint, baseModels: baseModelSets.Pony.baseModels },
    {
      type: ModelType.TextualInversion,
      baseModels: baseModelSets.Pony.baseModels,
      partialSupport: ['SD 1.5', ...sdxlEcosystemPartialSupport],
    },
    {
      type: ModelType.LORA,
      baseModels: baseModelSets.Pony.baseModels,
      partialSupport: sdxlEcosystemPartialSupport,
    },
    {
      type: ModelType.DoRA,
      baseModels: baseModelSets.Pony.baseModels,
      partialSupport: sdxlEcosystemPartialSupport,
    },
    {
      type: ModelType.LoCon,
      baseModels: baseModelSets.Pony.baseModels,
      partialSupport: sdxlEcosystemPartialSupport,
    },
    {
      type: ModelType.VAE,
      baseModels: [...baseModelSets.SDXL.baseModels],
    },
  ],
  Illustrious: [
    { type: ModelType.Checkpoint, baseModels: baseModelSets.Illustrious.baseModels },
    {
      type: ModelType.TextualInversion,
      baseModels: baseModelSets.Illustrious.baseModels,
      partialSupport: ['SD 1.5', ...sdxlEcosystemPartialSupport],
    },
    {
      type: ModelType.LORA,
      baseModels: baseModelSets.Illustrious.baseModels,
      partialSupport: sdxlEcosystemPartialSupport,
    },
    {
      type: ModelType.DoRA,
      baseModels: baseModelSets.Illustrious.baseModels,
      partialSupport: sdxlEcosystemPartialSupport,
    },
    {
      type: ModelType.LoCon,
      baseModels: baseModelSets.Illustrious.baseModels,
      partialSupport: sdxlEcosystemPartialSupport,
    },
    {
      type: ModelType.VAE,
      baseModels: [...baseModelSets.SDXL.baseModels],
    },
  ],
  NoobAI: [
    { type: ModelType.Checkpoint, baseModels: baseModelSets.NoobAI.baseModels },
    {
      type: ModelType.TextualInversion,
      baseModels: baseModelSets.NoobAI.baseModels,
      partialSupport: ['SD 1.5', ...sdxlEcosystemPartialSupport],
    },
    {
      type: ModelType.LORA,
      baseModels: baseModelSets.NoobAI.baseModels,
      partialSupport: sdxlEcosystemPartialSupport,
    },
    {
      type: ModelType.DoRA,
      baseModels: baseModelSets.NoobAI.baseModels,
      partialSupport: sdxlEcosystemPartialSupport,
    },
    {
      type: ModelType.LoCon,
      baseModels: baseModelSets.NoobAI.baseModels,
      partialSupport: sdxlEcosystemPartialSupport,
    },
    {
      type: ModelType.VAE,
      baseModels: [...baseModelSets.SDXL.baseModels],
    },
  ],
  Flux1: [
    { type: ModelType.Checkpoint, baseModels: baseModelSets.Flux1.baseModels },
    { type: ModelType.LORA, baseModels: baseModelSets.Flux1.baseModels },
  ],
  Flux1Kontext: [{ type: ModelType.Checkpoint, baseModels: baseModelSets.Flux1Kontext.baseModels }],
  // SD3: [
  //   { type: ModelType.Checkpoint, baseModels: baseModelSets.SD3.baseModels },
  //   { type: ModelType.LORA, baseModels: baseModelSets.SD3.baseModels },
  // ],
  // SD3_5M: [
  //   { type: ModelType.Checkpoint, baseModels: baseModelSets.SD3_5M.baseModels },
  //   { type: ModelType.LORA, baseModels: baseModelSets.SD3_5M.baseModels },
  // ],
  HiDream: [
    { type: ModelType.Checkpoint, baseModels: baseModelSets.HiDream.baseModels },
    { type: ModelType.LORA, baseModels: baseModelSets.HiDream.baseModels },
  ],
  HyV1: [{ type: ModelType.LORA, baseModels: baseModelSets.HyV1.baseModels }],
  OpenAI: [{ type: ModelType.Checkpoint, baseModels: baseModelSets.OpenAI.baseModels }],
  Imagen4: [{ type: ModelType.Checkpoint, baseModels: baseModelSets.Imagen4.baseModels }],
  WanVideo: [{ type: ModelType.LORA, baseModels: baseModelSets.WanVideo.baseModels }],
  WanVideo1_3B_T2V: [
    { type: ModelType.LORA, baseModels: baseModelSets.WanVideo1_3B_T2V.baseModels },
  ],
  WanVideo14B_T2V: [{ type: ModelType.LORA, baseModels: baseModelSets.WanVideo14B_T2V.baseModels }],
  WanVideo14B_I2V_480p: [
    { type: ModelType.LORA, baseModels: baseModelSets.WanVideo14B_I2V_480p.baseModels },
  ],
  WanVideo14B_I2V_720p: [
    { type: ModelType.LORA, baseModels: baseModelSets.WanVideo14B_I2V_720p.baseModels },
  ],
};
export function getBaseModelResourceTypes(baseModel: string) {
  if (baseModel in baseModelResourceTypes)
    return baseModelResourceTypes[baseModel as SupportedBaseModel];
}

export function getImageGenerationBaseModels() {
  return [
    ...new Set(
      Object.entries(baseModelResourceTypes)
        .filter(([key]) => !videoBaseModelSetTypes.includes(key as BaseModelSetType))
        .flatMap(([key, value]) => value.flatMap((x) => x.baseModels))
    ),
  ];
}

export const miscModelTypes: ModelType[] = [
  'AestheticGradient',
  'Hypernetwork',
  'Controlnet',
  'Upscaler',
  'MotionModule',
  'Poses',
  'Wildcards',
  'Workflows',
  'Detection',
  'Other',
] as const;

const fluxStandardModelId = 618692;
export const fluxStandardAir = 'urn:air:flux1:checkpoint:civitai:618692@691639';
export const fluxUltraAir = 'urn:air:flux1:checkpoint:civitai:618692@1088507';
export const fluxDraftAir = 'urn:air:flux1:checkpoint:civitai:618692@699279';
export const fluxUltraAirId = 1088507;
export const fluxModeOptions = [
  { label: 'Draft', value: fluxDraftAir },
  { label: 'Standard', value: fluxStandardAir },
  { label: 'Pro', value: 'urn:air:flux1:checkpoint:civitai:618692@699332' },
  { label: 'Pro 1.1', value: 'urn:air:flux1:checkpoint:civitai:618692@922358' },
  { label: 'Ultra', value: fluxUltraAir },
];

export function getBaseModelSetTypes({
  modelType,
  baseModel,
  defaultType = 'SD1',
}: {
  modelType: ModelType;
  baseModel?: string;
  defaultType?: SupportedBaseModel;
}) {
  if (!baseModel) return [defaultType];
  return Object.entries(baseModelResourceTypes)
    .filter(([key, config]) => {
      if (key === baseModel) return true;
      const match = config.find((x) => x.type === modelType);
      const baseModels = match?.baseModels ?? [];
      const partialSupport = (match as any)?.partialSupport ?? [];
      const combined = [...baseModels, ...partialSupport];
      return combined.includes(baseModel);
    })
    .map(([key]) => key) as SupportedBaseModel[];
}
// #endregion

// #region [workflows]

export const fluxUltraAspectRatios = [
  { label: 'Landscape - 21:9', width: 3136, height: 1344 },
  { label: 'Landscape - 16:9', width: 2752, height: 1536 },
  { label: 'Landscape - 4:3', width: 2368, height: 1792 },
  { label: 'Square - 1:1', width: 2048, height: 2048 },
  { label: 'Portrait - 3:4', width: 1792, height: 2368 },
  { label: 'Portrait - 9:16', width: 1536, height: 2752 },
  { label: 'Portrait - 9:21', width: 1344, height: 3136 },
];
const defaultFluxUltraAspectRatioIndex = generation.defaultValues.fluxUltraAspectRatio;

export const fluxModelId = 618692;
export function getIsFluxUltra({ modelId, fluxMode }: { modelId?: number; fluxMode?: string }) {
  return modelId === fluxModelId && fluxMode === fluxUltraAir;
}

export function getSizeFromFluxUltraAspectRatio(value: number) {
  return fluxUltraAspectRatios[value] ?? fluxUltraAspectRatios[defaultFluxUltraAspectRatioIndex];
}

export function getClosestFluxUltraAspectRatio(width = 1024, height = 1024) {
  const ratios = fluxUltraAspectRatios.map((x) => x.width / x.height);
  const closest = findClosest(ratios, width / height);
  const index = ratios.indexOf(closest);
  return `${index ?? defaultFluxUltraAspectRatioIndex}`;
}

type GetUpscaleFactorProps = {
  width: number;
  height: number;
};
export function getUpscaleFactor(original: GetUpscaleFactorProps, upscale: GetUpscaleFactorProps) {
  const s1 = original.width > original.height ? original.width : original.height;
  const s2 = upscale.width > upscale.height ? upscale.width : upscale.height;
  return Math.round((s2 / s1) * 10) / 10;
}

export function getScaledWidthHeight(width: number, height: number, factor: number) {
  const originRatio = width / height;
  const wf = width * factor;
  const hf = height * factor;

  const wLimits = getUpperLowerLimits(wf);
  const hLimits = getUpperLowerLimits(hf);

  const options: { ratio: number; width: number; height: number }[] = [];

  for (const wl of wLimits) {
    for (const hl of hLimits) {
      options.push({ ratio: wl / hl, width: wl, height: hl });
    }
  }

  const closestRatio = findClosest(
    options.map(({ ratio }) => ratio),
    originRatio
  );
  const closest = options.find(({ ratio }) => ratio === closestRatio)!;
  return { width: closest.width, height: closest.height };
}

function getUpperLowerLimits(value: number) {
  // return [...new Set([Math.floor, Math.ceil].map((fn) => fn(value / 64) * 64))];
  return [
    ...new Set(
      [Math.floor, Math.ceil].flatMap((fn) => {
        const val = fn(value / 64) * 64;
        const arr = [val];
        const lower = val - 64;
        const upper = val + 64;
        if (lower >= minDownscaleSize) arr.push(lower);
        if (upper <= maxUpscaleSize) arr.push(upper);
        return arr;
      })
    ),
  ];
}
