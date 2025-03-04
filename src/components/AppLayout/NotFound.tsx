import { Button, Container, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';
import { Meta } from '~/components/Meta/Meta';

export function NotFound() {
  return (
    <>
      <Meta title="Page Not Found" deIndex="noindex, nofollow" />

      <Container size="xl" p="xl">
        <Stack align="center">
          <Title order={1}>404</Title>
          <Text size="xl">The page you are looking for doesn&apos;t exist</Text>
          <Link href="/">
            <Button>Go back home</Button>
          </Link>
        </Stack>
      </Container>
    </>
  );
}
