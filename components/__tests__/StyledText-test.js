import * as React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { MonoText } from '../StyledText';

it('renders text with the monospace font', async () => {
  const { getByText } = await render(<MonoText>Snapshot test!</MonoText>);
  expect(getByText('Snapshot test!')).toHaveStyle({ fontFamily: 'SpaceMono' });
});
