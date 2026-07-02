import { render } from '@testing-library/react-native';

import { FurniturePlaceholder } from '@/components/room/furniture-placeholder';
import { FURNITURE_ITEMS } from '@/resources/furniture';

const bed = FURNITURE_ITEMS.find((f) => f.id === 'bed')!;

describe('FurniturePlaceholder', () => {
  it('renders the Korean furniture name by default', async () => {
    const { getByText } = await render(<FurniturePlaceholder item={bed} />);
    expect(getByText('포근한 침대')).toBeTruthy();
  });

  it('hides the name but keeps the accessibility label when showName is false', async () => {
    const { queryByText, getByLabelText } = await render(
      <FurniturePlaceholder item={bed} showName={false} />,
    );
    expect(queryByText('포근한 침대')).toBeNull();
    expect(getByLabelText('포근한 침대')).toBeTruthy();
  });
});
