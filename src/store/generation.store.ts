import { ModelType } from '@prisma/client';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { generation, getGenerationConfig } from '~/server/common/constants';
import { GenerateFormModel, GetGenerationDataInput } from '~/server/schema/generation.schema';
import { Generation } from '~/server/services/generation/generation.types';
import { showErrorNotification } from '~/utils/notifications';
import { findClosest } from '~/utils/number-helpers';
import { removeEmpty } from '~/utils/object-helpers';
import { QS } from '~/utils/qs';

export type RunType = 'run' | 'remix' | 'random' | 'params';
type DrawerOptions = { fullHeight?: boolean };
type View = 'queue' | 'generate' | 'feed';
type GenerationState = {
  opened: boolean;
  view: View;
  drawerOptions: DrawerOptions;
  data?: { type: RunType; data: Partial<GenerateFormModel> };
  // used to populate form with model/image generation data
  open: (input?: GetGenerationDataInput, drawerOptions?: DrawerOptions) => Promise<void>;
  close: () => void;
  setView: (view: View) => void;
  randomize: (includeResources?: boolean) => Promise<void>;
  setParams: (data: Generation.Data['params']) => void;
  setData: (args: { data: Generation.Data; type: RunType }) => void;
  clearData: () => void;
};

export const useGenerationStore = create<GenerationState>()(
  devtools(
    immer((set, get) => ({
      opened: false,
      view: 'generate',
      drawerOptions: { fullHeight: false },
      open: async (input, drawerOptions) => {
        set((state) => {
          state.opened = true;
          if (input) state.view = 'generate';
          if (drawerOptions) state.drawerOptions = drawerOptions;
        });

        if (!input) return;
        const data = await getGenerationData(input);
        const type =
          input.type === 'model' || input.type === 'modelVersion'
            ? 'run'
            : input.type === 'image'
            ? 'remix'
            : 'random';
        if (data) get().setData({ type, data: { ...data } });
      },
      close: () =>
        set((state) => {
          state.opened = false;
          state.drawerOptions = {};
        }),
      setView: (view) =>
        set((state) => {
          state.view = view;
        }),
      setParams: (params) => {
        const data = formatGenerationData('params', { resources: [], params });

        set((state) => {
          state.data = {
            type: 'params',
            data: { ...data },
          };
        });
      },
      setData: ({ data, type }) =>
        set((state) => {
          state.view = 'generate';
          state.data = { type, data: formatGenerationData(type, data) };
        }),
      randomize: async (includeResources) => {
        const data = await getGenerationData({ type: 'random', includeResources });
        if (data) get().setData({ type: 'random', data });
      },
      clearData: () =>
        set((state) => {
          state.data = undefined;
        }),
    })),
    { name: 'generation-store' }
  )
);

const store = useGenerationStore.getState();
export const generationPanel = {
  open: store.open,
  close: store.close,
  setView: store.setView,
};

export const generationStore = {
  setData: store.setData,
  setParams: store.setParams,
  clearData: store.clearData,
  randomize: store.randomize,
};

const dictionary: Record<string, Generation.Data> = {};
const getGenerationData = async (input: GetGenerationDataInput) => {
  try {
    const key = input.type !== 'random' ? `${input.type}_${input.id}` : undefined;
    if (key && dictionary[key]) return dictionary[key];
    else {
      const response = await fetch(`/api/generation/data?${QS.stringify(input)}`);
      if (!response.ok) throw new Error(response.statusText);
      const data: Generation.Data = await response.json();
      if (key) dictionary[key] = data;
      return data;
    }
  } catch (error: any) {
    showErrorNotification({ error });
  }
};

const formatGenerationData = (
  type: RunType,
  { resources, params }: Generation.Data
): Partial<GenerateFormModel> => {
  const aspectRatio =
    params?.width && params.height
      ? getClosestAspectRatio(params?.width, params?.height, params?.baseModel)
      : undefined;

  if (params?.sampler)
    params.sampler = generation.samplers.includes(params.sampler as any)
      ? params.sampler
      : undefined;

  const additionalResourceTypes = getGenerationConfig(
    params?.baseModel
  ).additionalResourceTypes.map((x) => x.type);

  const additionalResources = resources.filter((x) =>
    additionalResourceTypes.includes(x.modelType as any)
  );

  const model = resources.find((x) => x.modelType === ModelType.Checkpoint);

  const formData: Partial<GenerateFormModel> =
    type !== 'remix' ? removeEmpty({ ...params, aspectRatio }) : { ...params, aspectRatio };
  if (type === 'params') return formData;
  else if (type === 'run') {
    return {
      ...formData,
      model,
      resources: additionalResources,
    };
  } else {
    const vae = resources.find((x) => x.modelType === ModelType.VAE);

    return {
      ...formData,
      model,
      vae,
      resources: !!additionalResources.length ? additionalResources : undefined,
    };
  }
};

export const getClosestAspectRatio = (width?: number, height?: number, baseModel?: string) => {
  width = width ?? (baseModel === 'SDXL' ? 1024 : 512);
  height = height ?? (baseModel === 'SDXL' ? 1024 : 512);
  const aspectRatios = getGenerationConfig(baseModel).aspectRatios;
  const ratios = aspectRatios.map((x) => x.width / x.height);
  const closest = findClosest(ratios, width / height);
  const index = ratios.indexOf(closest);
  return `${index ?? 0}`;
};
