import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from '@/components/SearchBar';
import { useRouter } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('SearchBar Component', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  describe('Rendering', () => {
    it('should render all form elements', () => {
      render(<SearchBar />);

      expect(screen.getByLabelText(/artist/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/album/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/region/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /find music stores/i })).toBeInTheDocument();
    });

    it('should render with initial values', () => {
      render(<SearchBar initialArtist="Radiohead" initialAlbum="OK Computer" initialRegion="GB" />);

      expect(screen.getByDisplayValue('Radiohead')).toBeInTheDocument();
      expect(screen.getByDisplayValue('OK Computer')).toBeInTheDocument();
      expect(screen.getByDisplayValue(/United Kingdom/i)).toBeInTheDocument();
    });

    it('should have required attribute on artist field', () => {
      render(<SearchBar />);

      const artistInput = screen.getByLabelText(/artist/i);
      expect(artistInput).toBeRequired();
    });

    it('should not have required attribute on album field', () => {
      render(<SearchBar />);

      const albumInput = screen.getByLabelText(/album/i);
      expect(albumInput).not.toBeRequired();
    });
  });

  describe('Form Validation', () => {
    it('should disable submit button when artist is empty', () => {
      render(<SearchBar />);

      const submitButton = screen.getByRole('button', { name: /find music stores/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when artist is filled', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const artistInput = screen.getByLabelText(/artist/i);
      const submitButton = screen.getByRole('button', { name: /find music stores/i });

      await user.type(artistInput, 'Radiohead');

      expect(submitButton).not.toBeDisabled();
    });

    it('should disable submit button if artist is only whitespace', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const artistInput = screen.getByLabelText(/artist/i);
      const submitButton = screen.getByRole('button', { name: /find music stores/i });

      await user.type(artistInput, '   ');

      expect(submitButton).toBeDisabled();
    });

    it('should enforce maxLength on inputs', () => {
      render(<SearchBar />);

      const artistInput = screen.getByLabelText(/artist/i);
      const albumInput = screen.getByLabelText(/album/i);

      expect(artistInput).toHaveAttribute('maxLength', '100');
      expect(albumInput).toHaveAttribute('maxLength', '100');
    });
  });

  describe('Form Submission', () => {
    it('should navigate with artist parameter only', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const artistInput = screen.getByLabelText(/artist/i);
      const submitButton = screen.getByRole('button', { name: /find music stores/i });

      await user.type(artistInput, 'Radiohead');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/search?artist=Radiohead');
      });
    });

    it('should navigate with both artist and album parameters', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const artistInput = screen.getByLabelText(/artist/i);
      const albumInput = screen.getByLabelText(/album/i);
      const submitButton = screen.getByRole('button', { name: /find music stores/i });

      await user.type(artistInput, 'Radiohead');
      await user.type(albumInput, 'OK Computer');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/search?artist=Radiohead&album=OK+Computer');
      });
    });

    it('should include region parameter if not US', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const artistInput = screen.getByLabelText(/artist/i);
      const regionSelect = screen.getByLabelText(/region/i);
      const submitButton = screen.getByRole('button', { name: /find music stores/i });

      await user.type(artistInput, 'Radiohead');
      await user.selectOptions(regionSelect, 'GB');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/search?artist=Radiohead&region=GB');
      });
    });

    it('should not include region parameter if US (default)', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const artistInput = screen.getByLabelText(/artist/i);
      const submitButton = screen.getByRole('button', { name: /find music stores/i });

      await user.type(artistInput, 'Radiohead');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/search?artist=Radiohead');
      });
    });

    it('should trim whitespace from inputs', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const artistInput = screen.getByLabelText(/artist/i);
      const albumInput = screen.getByLabelText(/album/i);
      const submitButton = screen.getByRole('button', { name: /find music stores/i });

      await user.type(artistInput, '  Radiohead  ');
      await user.type(albumInput, '  OK Computer  ');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/search?artist=Radiohead&album=OK+Computer');
      });
    });

    it('should not submit with Enter key if artist is empty', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const artistInput = screen.getByLabelText(/artist/i);
      await user.type(artistInput, '{Enter}');

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should submit with Enter key when artist is filled', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const artistInput = screen.getByLabelText(/artist/i);
      await user.type(artistInput, 'Radiohead{Enter}');

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/search?artist=Radiohead');
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state when submitting', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const artistInput = screen.getByLabelText(/artist/i);
      const submitButton = screen.getByRole('button', { name: /find music stores/i });

      await user.type(artistInput, 'Radiohead');
      await user.click(submitButton);

      // Should show loading text
      expect(screen.getByText(/searching/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('should show spinner icon during loading', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const artistInput = screen.getByLabelText(/artist/i);
      const submitButton = screen.getByRole('button', { name: /find music stores/i });

      await user.type(artistInput, 'Radiohead');
      await user.click(submitButton);

      // Should contain spinner (animate-spin class)
      const spinner = submitButton.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for all inputs', () => {
      render(<SearchBar />);

      expect(screen.getByLabelText(/artist/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/album/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/region/i)).toBeInTheDocument();
    });

    it('should have proper aria attributes on submit button', () => {
      render(<SearchBar />);

      const submitButton = screen.getByRole('button', { name: /find music stores/i });

      expect(submitButton).toHaveAttribute('type', 'submit');
    });

    it('should show which field is required', () => {
      render(<SearchBar />);

      // Artist label should have asterisk
      expect(screen.getByText(/artist \*/i)).toBeInTheDocument();
      // Album label should have "(optional)"
      expect(screen.getByText(/album \(optional\)/i)).toBeInTheDocument();
    });
  });

  describe('Region Selection', () => {
    it('should render all region options', () => {
      render(<SearchBar />);

      const regionSelect = screen.getByLabelText(/region/i);
      const options = Array.from(regionSelect.querySelectorAll('option'));

      expect(options).toHaveLength(7);
      expect(options.map(opt => opt.value)).toEqual(['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP']);
    });

    it('should update region when changed', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const regionSelect = screen.getByLabelText(/region/i);

      await user.selectOptions(regionSelect, 'GB');

      expect(regionSelect).toHaveValue('GB');
    });

    it('should default to US region', () => {
      render(<SearchBar />);

      const regionSelect = screen.getByLabelText(/region/i);
      expect(regionSelect).toHaveValue('US');
    });
  });
});
