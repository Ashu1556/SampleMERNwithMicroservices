import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/Home', () => ({
  __esModule: true,
  default: () => null,
}));

test('renders the application heading', () => {
  render(<App />);
  expect(screen.getByText(/welcome/i)).toBeInTheDocument();
});
