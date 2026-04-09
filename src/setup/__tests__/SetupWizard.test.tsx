import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetupWizard } from '../SetupWizard';

// Mock WLEDRestClient
const mockGetInfo = vi.fn();
vi.mock('@/core/wled/WLEDRestClient', () => ({
  WLEDRestClient: vi.fn().mockImplementation(() => ({
    getInfo: mockGetInfo,
  })),
}));

beforeEach(() => {
  mockGetInfo.mockReset();
  mockGetInfo.mockResolvedValue({
    name: 'HyperCube',
    ver: 'hs-1.6',
    leds: { count: 480 },
  });
});

describe('SetupWizard', () => {
  it('TestSetupWizard_Step1_RendersIpInputAndConnectButton', () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    expect(screen.getByLabelText(/IP Address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect/i })).toBeInTheDocument();
  });

  it('TestSetupWizard_Step1_ShowsSkipButton', () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    expect(screen.getByLabelText(/Skip/i)).toBeInTheDocument();
  });

  it('TestSetupWizard_Step1_EmptyInput_ShowsValidationError', async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Connect/i }));
    expect(screen.getByText('Please enter an IP address')).toBeInTheDocument();
  });

  it('TestSetupWizard_Step1_FailedConnection_ShowsError', async () => {
    mockGetInfo.mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    await user.type(screen.getByLabelText(/IP Address/i), '192.168.1.100');
    await user.click(screen.getByRole('button', { name: /Connect/i }));
    await waitFor(() => {
      expect(screen.getByText(/Could not reach HyperCube/i)).toBeInTheDocument();
    });
  });

  it('TestSetupWizard_Step2_ShowsDeviceInfo', async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    await user.type(screen.getByLabelText(/IP Address/i), '192.168.1.100');
    await user.click(screen.getByRole('button', { name: /Connect/i }));
    await waitFor(() => {
      expect(screen.getByText('HyperCube')).toBeInTheDocument();
      expect(screen.getByText('480 LEDs')).toBeInTheDocument();
    });
  });

  it('TestSetupWizard_Step2_HasNextButton', async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    await user.type(screen.getByLabelText(/IP Address/i), '192.168.1.100');
    await user.click(screen.getByRole('button', { name: /Connect/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
    });
  });

  it('TestSetupWizard_Step3_HasGetStartedButton', async () => {
    const user = userEvent.setup();
    render(<SetupWizard onComplete={vi.fn()} />);
    await user.type(screen.getByLabelText(/IP Address/i), '192.168.1.100');
    await user.click(screen.getByRole('button', { name: /Connect/i }));
    await waitFor(() => screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByRole('button', { name: /Get Started/i })).toBeInTheDocument();
  });

  it('TestSetupWizard_Skip_CallsOnComplete', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<SetupWizard onComplete={onComplete} />);
    await user.click(screen.getByLabelText(/Skip/i));
    expect(onComplete).toHaveBeenCalled();
  });

  it('TestSetupWizard_GetStarted_CallsOnComplete', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<SetupWizard onComplete={onComplete} />);
    await user.type(screen.getByLabelText(/IP Address/i), '192.168.1.100');
    await user.click(screen.getByRole('button', { name: /Connect/i }));
    await waitFor(() => screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await user.click(screen.getByRole('button', { name: /Get Started/i }));
    expect(onComplete).toHaveBeenCalledWith('192.168.1.100');
  });
});
