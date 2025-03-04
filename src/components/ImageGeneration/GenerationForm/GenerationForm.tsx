import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { IsClient } from '~/components/IsClient/IsClient';
import {
  GenerateFormModel,
  blockedRequest,
  generateFormSchema,
} from '~/server/schema/generation.schema';
import {
  getFormData,
  useDerivedGenerationState,
  useGenerationFormStore,
  keyupEditAttention,
} from '~/components/ImageGeneration/GenerationForm/generation.utils';
import React, { useEffect, useState } from 'react';
import { useBuzzTransaction } from '~/components/Buzz/buzz.utils';
import { numberWithCommas } from '~/utils/number-helpers';
import {
  constants,
  generation,
  generationConfig,
  getGenerationConfig,
} from '~/server/common/constants';
import { generationPanel, generationStore, useGenerationStore } from '~/store/generation.store';
import {
  useCreateGenerationRequest,
  useGetGenerationRequests,
  usePollGenerationRequests,
} from '~/components/ImageGeneration/utils/generationRequestHooks';
import { isDefined } from '~/utils/type-guards';
import {
  Form,
  InputNumber,
  InputNumberSlider,
  InputSegmentedControl,
  InputSelect,
  InputSwitch,
  InputTextArea,
} from '~/libs/form';
import { trpc } from '~/utils/trpc';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { parsePromptMetadata } from '~/utils/metadata';
import { imageGenerationSchema } from '~/server/schema/image.schema';
import { showErrorNotification } from '~/utils/notifications';
import {
  Anchor,
  Button,
  Card,
  CardProps,
  Center,
  NumberInputProps,
  Paper,
  ScrollArea,
  SliderProps,
  Stack,
  Group,
  Text,
  createStyles,
  Accordion,
  CopyButton,
  Input,
  Divider,
  Badge,
} from '@mantine/core';
import { DismissibleAlert } from '~/components/DismissibleAlert/DismissibleAlert';
import { LoginRedirect } from '~/components/LoginRedirect/LoginRedirect';
import InputResourceSelect from '~/components/ImageGeneration/GenerationForm/ResourceSelect';
import { PersistentAccordion } from '~/components/PersistentAccordion/PersistantAccordion';
import { AlertWithIcon } from '~/components/AlertWithIcon/AlertWithIcon';
import { IconAlertTriangle, IconArrowAutofitDown, IconCheck, IconCopy } from '@tabler/icons-react';
import InputResourceSelectMultiple from '~/components/ImageGeneration/GenerationForm/ResourceSelectMultiple';
import { TrainedWords } from '~/components/TrainedWords/TrainedWords';
import InputSeed from '~/components/ImageGeneration/GenerationForm/InputSeed';
import { ModelType } from '@prisma/client';
import { getDisplayName } from '~/utils/string-helpers';
import { getHotkeyHandler } from '@mantine/hooks';

const GenerationFormInnner = ({ onSuccess }: { onSuccess?: () => void }) => {
  const { classes } = useStyles();
  const currentUser = useCurrentUser();
  const { nsfw, quantity } = useGenerationFormStore.getState();
  const defaultValues = {
    ...generation.defaultValues,
    nsfw: nsfw ?? currentUser?.showNsfw,
    quantity: quantity ?? generation.defaultValues.quantity,
  };

  const form = useForm<GenerateFormModel>({
    resolver: zodResolver(generateFormSchema),
    mode: 'onSubmit',
    shouldUnregister: false,
    defaultValues,
  });

  useEffect(() => {
    form.reset({
      ...defaultValues,
      ...useGenerationFormStore.getState(),
    });
    const subscription = form.watch((value, { name, type }) => {
      useGenerationFormStore.setState({ ...(value as GenerateFormModel) }, true);
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line

  const {
    totalCost,
    baseModel,
    hasResources,
    trainedWords,
    additionalResourcesCount,
    samplerCfgOffset,
    isSDXL,
    isLCM,
  } = useDerivedGenerationState();

  const { conditionalPerformTransaction } = useBuzzTransaction({
    message: (requiredBalance) =>
      `You don't have enough funds to perform this action. Required buzz: ${numberWithCommas(
        requiredBalance
      )}. Buy or earn more buzz to perform this action.`,
    performTransactionOnPurchase: true,
  });

  const handleClearAll = () => {
    const { nsfw, quantity } = useGenerationFormStore.getState();
    form.reset({
      ...generation.defaultValues,
      nsfw,
      quantity,
    });
  };

  const createData = useGenerationStore((state) => state.data);

  // sync form with `create` data
  useEffect(() => {
    if (!createData) return;
    const { data, type } = createData;
    const formData = getFormData(type, data);

    // set default model
    const hasSdxlResources = formData.resources?.some((x) => x.baseModel?.includes('SDXL'));
    if (!formData.model) {
      formData.model = hasSdxlResources
        ? generationConfig.SDXL.checkpoint
        : generationConfig.SD1.checkpoint;
    }

    // Make sure we don't exceed max values
    const maxValueKeys = Object.keys(generation.maxValues);
    for (const item of maxValueKeys) {
      const key = item as keyof typeof generation.maxValues;
      if (formData[key]) {
        formData[key] = Math.min(formData[key] ?? 0, generation.maxValues[key]);
      }
    }

    useGenerationStore.setState({ data: undefined });
    form.reset(formData);
  }, [createData]); // eslint-disable-line

  // #region [mutations]
  const { mutateAsync, isLoading } = useCreateGenerationRequest();
  const handleSubmit = async (data: GenerateFormModel) => {
    const { model, resources = [], vae, ...params } = data;
    const _resources = [model, ...resources, vae].filter(isDefined).map((resource) => {
      if (resource.modelType === 'TextualInversion')
        return { ...resource, triggerWord: resource.trainedWords[0] };
      return resource;
    });

    const performTransaction = async () => {
      await mutateAsync({
        resources: _resources.filter((x) => x.covered !== false),
        params: { ...params, baseModel },
      }).catch(() => null); // catching here since error is handled at the mutation event level
      onSuccess?.();
      generationPanel.setView('queue');
    };

    conditionalPerformTransaction(totalCost, performTransaction);
  };

  const { mutateAsync: reportProhibitedRequest } = trpc.user.reportProhibitedRequest.useMutation();
  const handleError = async (e: unknown) => {
    const promptError = (e as any)?.prompt as any;
    if (promptError?.type === 'custom') {
      const status = blockedRequest.status();
      if (status === 'notified' || status === 'muted') {
        const isBlocked = await reportProhibitedRequest({ prompt: promptError.ref.value });
        if (isBlocked) currentUser?.refresh();
      }
    }
  };
  // #endregion

  // #region [handle parse prompt]
  const [showFillForm, setShowFillForm] = useState(false);
  const handleParsePrompt = async () => {
    const prompt = form.getValues('prompt');
    const metadata = parsePromptMetadata(prompt);
    const result = imageGenerationSchema.safeParse(metadata);
    if (result.success) {
      generationStore.setParams(result.data);
      setShowFillForm(false);
    } else {
      console.error(result.error);
      showErrorNotification({
        title: 'Unable to parse prompt',
        error: new Error('We are unable to fill out the form with the provided prompt.'),
      });
    }
  };
  // #endregion

  const promptKeyHandler = getHotkeyHandler([
    ['mod+Enter', () => form.handleSubmit(handleSubmit)()],
    [
      'mod+ArrowUp',
      (event) => keyupEditAttention(event as React.KeyboardEvent<HTMLTextAreaElement>),
    ],
    [
      'mod+ArrowDown',
      (event) => keyupEditAttention(event as React.KeyboardEvent<HTMLTextAreaElement>),
    ],
  ]);

  const { requests } = useGetGenerationRequests();
  const pendingProcessingCount = usePollGenerationRequests(requests);
  const reachedRequestLimit =
    pendingProcessingCount >= constants.imageGeneration.maxConcurrentRequests;
  const disableGenerateButton = reachedRequestLimit;

  // Manually handle error display for prompt box
  const { errors } = form.formState;

  return (
    <Form
      form={form}
      onSubmit={handleSubmit}
      onError={handleError}
      style={{ width: '100%', position: 'relative', height: '100%' }}
    >
      <Stack spacing={0} h="100%">
        <ScrollArea sx={{ flex: 1 }}>
          <Stack p="md" pb={0}>
            {/* {type === 'remix' && (
              <DismissibleAlert
                id="image-gen-params"
                content="Not all of the resources used in this image are available at this time, we've populated as much of the generation parameters as possible"
              />
            )} */}
            <InputResourceSelect
              name="model"
              label="Model"
              labelProps={{ mb: 5, style: { fontWeight: 590 } }}
              buttonLabel="Add Model"
              withAsterisk
              options={{
                canGenerate: true,
                resources: [
                  {
                    type: ModelType.Checkpoint,
                    baseModelSet: hasResources ? baseModel : undefined,
                  },
                ],
              }}
              allowRemove={false}
            />
            <PersistentAccordion
              storeKey="generation-form-resources"
              classNames={{
                item: classes.accordionItem,
                control: classes.accordionControl,
                content: classes.accordionContent,
              }}
              variant="contained"
            >
              <Accordion.Item value="resources">
                <Accordion.Control>
                  <Group spacing={4}>
                    <Text size="sm" weight={590}>
                      Additional Resources
                    </Text>
                    {additionalResourcesCount > 0 && (
                      <Badge style={{ fontWeight: 590 }}>{additionalResourcesCount}</Badge>
                    )}
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <InputResourceSelectMultiple
                    name="resources"
                    limit={9}
                    buttonLabel="Add additional resource"
                    options={{
                      canGenerate: true,
                      resources: getGenerationConfig(baseModel).additionalResourceTypes,
                    }}
                  />
                </Accordion.Panel>
              </Accordion.Item>
            </PersistentAccordion>
            <Card {...sharedCardProps}>
              <Stack>
                <Stack spacing={0}>
                  <Input.Wrapper label="Prompt" error={errors.prompt?.message} withAsterisk>
                    <Paper
                      px="sm"
                      bg="transparent"
                      sx={(theme) => ({
                        borderBottomLeftRadius: showFillForm ? 0 : undefined,
                        borderBottomRightRadius: showFillForm ? 0 : undefined,
                        borderColor: errors.prompt
                          ? theme.colors.red[theme.fn.primaryShade()]
                          : undefined,
                        marginBottom: errors.prompt ? 5 : undefined,

                        // Apply focus styles if textarea is focused
                        '&:has(textarea:focus)': {
                          ...theme.focusRingStyles.inputStyles(theme),
                        },
                      })}
                      withBorder
                    >
                      <InputTextArea
                        name="prompt"
                        placeholder="Your prompt goes here..."
                        autosize
                        unstyled
                        styles={(theme) => ({
                          input: {
                            background: 'transparent',
                            width: '100%',
                            resize: 'none',
                            border: 'none',
                            padding: '0',
                            outline: 'none',
                            fontFamily: theme.fontFamily,
                            fontSize: theme.fontSizes.sm,
                            lineHeight: theme.lineHeight,
                            overflow: 'hidden',
                            color: theme.colorScheme === 'dark' ? theme.colors.dark[0] : undefined,
                          },
                          // Prevents input from displaying form error
                          error: { display: 'none' },
                          wrapper: { margin: 0 },
                        })}
                        onPaste={(event) => {
                          const text = event.clipboardData.getData('text/plain');
                          if (text) setShowFillForm(text.includes('Steps:'));
                        }}
                        onKeyDown={promptKeyHandler}
                      />
                      {trainedWords.length > 0 ? (
                        <Stack spacing={8} mb="xs">
                          <Divider />
                          <Text color="dimmed" size="xs" weight={590}>
                            Trigger words
                          </Text>
                          <Group spacing={4}>
                            <TrainedWords
                              type="LORA"
                              trainedWords={trainedWords}
                              badgeProps={{ style: { textTransform: 'none' } }}
                            />
                            <CopyButton value={trainedWords.join(', ')}>
                              {({ copied, copy }) => (
                                <Button
                                  variant="subtle"
                                  size="xs"
                                  color={copied ? 'green' : 'blue.5'}
                                  onClick={copy}
                                  compact
                                >
                                  {copied ? (
                                    <Group spacing={4}>
                                      Copied <IconCheck size={14} />
                                    </Group>
                                  ) : (
                                    <Group spacing={4}>
                                      Copy all <IconCopy size={14} />
                                    </Group>
                                  )}
                                </Button>
                              )}
                            </CopyButton>
                          </Group>
                        </Stack>
                      ) : null}
                    </Paper>
                  </Input.Wrapper>
                  {showFillForm && (
                    <Button
                      variant="light"
                      onClick={handleParsePrompt}
                      leftIcon={<IconArrowAutofitDown size={16} />}
                      sx={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
                      fullWidth
                    >
                      Apply Parameters
                    </Button>
                  )}
                </Stack>

                <InputTextArea
                  name="negativePrompt"
                  label="Negative Prompt"
                  onKeyDown={promptKeyHandler}
                  autosize
                />
                {!isSDXL && <InputSwitch name="nsfw" label="Mature content" labelPosition="left" />}
              </Stack>
            </Card>
            <Card {...sharedCardProps} style={{ overflow: 'visible' }}>
              <Stack>
                <Stack spacing={0}>
                  <Input.Label>Aspect Ratio</Input.Label>
                  <InputSegmentedControl
                    name="aspectRatio"
                    data={getAspectRatioControls(baseModel)}
                  />
                </Stack>
                <PersistentAccordion
                  storeKey="generation-form-advanced"
                  variant="filled"
                  styles={(theme) => ({
                    content: {
                      padding: 0,
                    },
                    item: {
                      overflow: 'hidden',
                      border: 'none',
                      background: 'transparent',
                    },
                    control: {
                      padding: 0,
                      paddingBottom: theme.spacing.xs,
                    },
                  })}
                >
                  <Accordion.Item value="advanced">
                    <Accordion.Control>
                      <Divider
                        label="Advanced"
                        labelPosition="left"
                        labelProps={{ size: 'sm', weight: 500 }}
                      />
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack>
                        <InputNumberSlider
                          name="cfgScale"
                          label="CFG Scale"
                          min={1}
                          max={isSDXL ? 10 : 30}
                          step={0.5}
                          precision={1}
                          sliderProps={sharedSliderProps}
                          numberProps={sharedNumberProps}
                          presets={[
                            { label: 'Creative', value: '4' },
                            { label: 'Balanced', value: '7' },
                            { label: 'Precise', value: '10' },
                          ]}
                          reverse
                        />
                        <InputSelect
                          name="sampler"
                          label="Sampler"
                          data={isLCM ? generation.lcmSamplers : generation.samplers}
                          presets={
                            isLCM
                              ? []
                              : [
                                  { label: 'Fast', value: 'Euler a' },
                                  { label: 'Popular', value: 'DPM++ 2M Karras' },
                                ]
                          }
                        />
                        <InputNumberSlider
                          name="steps"
                          label="Steps"
                          min={isLCM ? 3 : 10}
                          max={isLCM ? 12 : generation.maxValues.steps}
                          sliderProps={sharedSliderProps}
                          numberProps={sharedNumberProps}
                          presets={
                            isLCM
                              ? []
                              : [
                                  {
                                    label: 'Fast',
                                    value: Number(10 + samplerCfgOffset).toString(),
                                  },
                                  {
                                    label: 'Balanced',
                                    value: Number(20 + samplerCfgOffset).toString(),
                                  },
                                  {
                                    label: 'High',
                                    value: Number(30 + samplerCfgOffset).toString(),
                                  },
                                ]
                          }
                          reverse
                        />
                        <InputSeed
                          name="seed"
                          label="Seed"
                          min={1}
                          max={generation.maxValues.seed}
                        />
                        {!isSDXL && (
                          <InputNumberSlider
                            name="clipSkip"
                            label="Clip Skip"
                            min={1}
                            max={generation.maxValues.clipSkip}
                            sliderProps={{
                              ...sharedSliderProps,
                              marks: clipSkipMarks,
                            }}
                            numberProps={sharedNumberProps}
                          />
                        )}
                        <InputResourceSelect
                          name="vae"
                          label={getDisplayName(ModelType.VAE)}
                          buttonLabel="Add VAE"
                          options={{
                            canGenerate: true,
                            resources: [{ type: ModelType.VAE, baseModelSet: baseModel }],
                          }}
                        />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                </PersistentAccordion>
              </Stack>
            </Card>
            {/* <Card {...sharedCardProps}>
          <Stack>
            <Text>TODO.hires</Text>
          </Stack>
          </Card> */}
          </Stack>
        </ScrollArea>
        <Stack spacing={4} p="md">
          <Group spacing="xs" className={classes.generateButtonContainer} noWrap>
            <Card withBorder className={classes.generateButtonQuantity} p={0}>
              <Stack spacing={0}>
                <Text
                  size="xs"
                  color="dimmed"
                  weight={500}
                  ta="center"
                  className={classes.generateButtonQuantityText}
                >
                  Quantity
                </Text>
                <InputNumber
                  name="quantity"
                  min={1}
                  max={generation.maxValues.quantity}
                  className={classes.generateButtonQuantityInput}
                />
              </Stack>
            </Card>
            <LoginRedirect reason="image-gen" returnUrl="/generate">
              {/* TODO.generation: Uncomment this out by next week */}
              {/* {isSDXL ? (
                      <BuzzTransactionButton
                        type="submit"
                        size="lg"
                        label="Generate"
                        loading={isSubmitting || loading}
                        className={classes.generateButtonButton}
                        disabled={disableGenerateButton}
                        buzzAmount={totalCost}
                      />
                    ) : (
                      <Button
                        type="submit"
                        size="lg"
                        loading={isSubmitting || loading}
                        className={classes.generateButtonButton}
                        disabled={disableGenerateButton}
                      >
                        Generate
                      </Button>
                    )} */}
              <Button
                type="submit"
                size="lg"
                loading={isLoading}
                className={classes.generateButtonButton}
                disabled={disableGenerateButton}
              >
                Generate
              </Button>
            </LoginRedirect>
            {/* <Tooltip label="Reset" color="dark" withArrow> */}
            <Button
              onClick={handleClearAll}
              variant="outline"
              className={classes.generateButtonReset}
              px="xs"
            >
              {/* <IconX size={20} strokeWidth={3} /> */}
              Clear All
            </Button>
            {/* </Tooltip> */}
          </Group>
          <Text size="xs" color="dimmed">
            {reachedRequestLimit
              ? 'You have reached the request limit. Please wait until your current requests are finished.'
              : `You can queue ${
                  constants.imageGeneration.maxConcurrentRequests - pendingProcessingCount
                } more jobs`}
          </Text>
          <GenerationStatusMessage />
          {/* TODO.generation: Remove this by next week we start charging for sdxl generation */}
          {isSDXL && (
            <DismissibleAlert
              id="sdxl-free-preview"
              title="Free SDXL Generations!"
              content={
                <Text>
                  To celebrate{' '}
                  <Anchor
                    href="https://civitai.com/articles/2935/civitais-first-birthday-a-year-of-art-code-and-community"
                    target="_blank"
                    underline
                  >
                    Civitai&apos;s Birthday
                  </Anchor>{' '}
                  we&apos;re letting everyone use SDXL for free!{' '}
                  <Anchor
                    href="https://education.civitai.com/using-civitai-the-on-site-image-generator/"
                    rel="noopener nofollow"
                    underline
                  >
                    After that it will cost a minimum of⚡3 Buzz per image
                  </Anchor>
                  . Complete our{' '}
                  <Anchor
                    href={`https://forms.clickup.com/8459928/f/825mr-6111/V0OXEDK2MIO5YKFZV4?Username=${
                      currentUser?.username ?? 'Unauthed'
                    }`}
                    rel="noopener nofollow"
                    target="_blank"
                    underline
                  >
                    SDXL generation survey
                  </Anchor>{' '}
                  to let us know how we did.
                </Text>
              }
            />
          )}
          {isLCM && (
            <DismissibleAlert
              id="lcm-preview"
              title="Initial LCM Support"
              content={
                <Text>
                  {`We're still testing out LCM support, please let us know if you run into any issues.`}
                </Text>
              }
            />
          )}
        </Stack>
      </Stack>
    </Form>
  );
};

export const GenerationForm = (args: { onSuccess?: () => void }) => {
  return (
    <IsClient>
      <GenerationFormInnner {...args} />
    </IsClient>
  );
};

const useStyles = createStyles((theme) => ({
  generationContainer: {},
  generateButtonContainer: {
    width: '100%',
    justifyContent: 'stretch',
    alignItems: 'stretch',
  },
  generateButtonQuantity: {
    width: 100,
    // borderTopRightRadius: 0,
    // borderBottomRightRadius: 0,
  },
  generateButtonQuantityText: {
    paddingRight: 25,
  },
  generateButtonQuantityInput: {
    marginTop: -20,
    input: {
      background: 'transparent',
      border: 'none',
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      borderTopLeftRadius: 0,
      textAlign: 'center',
      paddingRight: 25 + 12,
      paddingTop: 18,
      paddingBottom: 6,
      lineHeight: 1,
      fontWeight: 500,
      height: 'auto',
    },
  },
  generateButtonButton: {
    flex: 1,
    // borderRadius: 0,
    height: 'auto',
  },

  generateButtonReset: {
    // borderBottomLeftRadius: 0,
    // borderTopLeftRadius: 0,
    height: 'auto',
  },

  generateButtonRandom: {
    borderRadius: 0,
    height: 'auto',
    order: 3,
  },
  promptInputLabel: {
    display: 'inline-flex',
    gap: 4,
    marginBottom: 5,
    alignItems: 'center',
  },
  accordionItem: {
    '&:first-of-type': {
      borderTopLeftRadius: '8px',
      borderTopRightRadius: '8px',
    },

    '&:last-of-type': {
      borderBottomLeftRadius: '8px',
      borderBottomRightRadius: '8px',
    },

    '&[data-active]': {
      backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[6] : 'transparent',
    },
  },
  accordionControl: {
    padding: '8px 8px 8px 12px',
    backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[6] : 'transparent',

    '&[data-active]': {
      borderRadius: '0 !important',
      borderBottom: `1px solid ${
        theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[2]
      }`,
    },
  },
  accordionContent: {
    padding: '8px 12px 12px 12px',
  },
}));

const sharedCardProps: Omit<CardProps, 'children'> = {
  withBorder: true,
  radius: 'md',
};

const sharedSliderProps: SliderProps = {
  size: 'sm',
};

const sharedNumberProps: NumberInputProps = {
  size: 'sm',
};

const getAspectRatioControls = (baseModel?: string) => {
  const aspectRatios = getGenerationConfig(baseModel).aspectRatios;
  return aspectRatios.map(({ label, width, height }, index) => ({
    label: (
      <Stack spacing={2}>
        <Center>
          <Paper
            withBorder
            sx={{ borderWidth: 2, aspectRatio: `${width}/${height}`, height: 20 }}
          />
        </Center>
        <Stack spacing={0}>
          <Text size="xs">{label}</Text>
          <Text size={10} color="dimmed">{`${width}x${height}`}</Text>
        </Stack>
      </Stack>
    ),
    value: `${index}`,
  }));
};

const GenerationStatusMessage = () => {
  const { data: status, isLoading } = trpc.generation.getStatusMessage.useQuery(undefined, {
    cacheTime: 0,
  });
  if (isLoading || !status) return null;

  return (
    <AlertWithIcon
      color="yellow"
      title="Image Generation Status Alert"
      icon={<IconAlertTriangle />}
      iconColor="yellow"
    >
      {status}
    </AlertWithIcon>
  );
};

const clipSkipMarks = Array(10)
  .fill(0)
  .map((_, index) => ({ value: index + 1 }));
