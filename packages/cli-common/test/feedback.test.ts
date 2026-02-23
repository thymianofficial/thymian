import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Feedback } from '../src/feedback.js';

describe('Feedback', () => {
  let mockOnRun: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnRun = vi.fn().mockResolvedValue(undefined);
  });

  describe('run', () => {
    it('should not execute hook if wasRun is true', async () => {
      const feedback = new Feedback(true, mockOnRun);

      await feedback.run();

      expect(mockOnRun).not.toHaveBeenCalled();
    });

    it('should execute hook with probability when wasRun is false', async () => {
      const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const feedback = new Feedback(false, mockOnRun);

      await feedback.run();

      expect(mockOnRun).toHaveBeenCalledTimes(1);
      mathRandomSpy.mockRestore();
    });

    it('should not execute hook when random value is >= 0.2', async () => {
      const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.3);

      const feedback = new Feedback(false, mockOnRun);

      await feedback.run();

      expect(mockOnRun).not.toHaveBeenCalled();
      mathRandomSpy.mockRestore();
    });

    it('should execute hook when random value is exactly at threshold', async () => {
      const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.19);

      const feedback = new Feedback(false, mockOnRun);

      await feedback.run();

      expect(mockOnRun).toHaveBeenCalledTimes(1);
      mathRandomSpy.mockRestore();
    });

    it('should set wasRun to true after execution', async () => {
      const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const feedback = new Feedback(false, mockOnRun);

      await feedback.run();
      await feedback.run();

      expect(mockOnRun).toHaveBeenCalledTimes(1);
      mathRandomSpy.mockRestore();
    });

    it('should not execute multiple times even when called multiple times', async () => {
      const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const feedback = new Feedback(false, mockOnRun);

      await feedback.run();
      await feedback.run();
      await feedback.run();

      expect(mockOnRun).toHaveBeenCalledTimes(1);
      mathRandomSpy.mockRestore();
    });

    it('should handle async onRun correctly', async () => {
      let resolved = false;
      const asyncOnRun = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        resolved = true;
      });

      const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const feedback = new Feedback(false, asyncOnRun);

      await feedback.run();

      expect(asyncOnRun).toHaveBeenCalled();
      expect(resolved).toBe(true);
      mathRandomSpy.mockRestore();
    });
  });

  describe('error', () => {
    it('should execute hook if not already run', async () => {
      const feedback = new Feedback(false, mockOnRun);

      await feedback.error();

      expect(mockOnRun).toHaveBeenCalledTimes(1);
    });

    it('should not re-execute if already run', async () => {
      const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const feedback = new Feedback(false, mockOnRun);

      await feedback.run();
      await feedback.error();

      expect(mockOnRun).toHaveBeenCalledTimes(1);
      mathRandomSpy.mockRestore();
    });

    it('should execute even if run was called but did not trigger', async () => {
      const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const feedback = new Feedback(false, mockOnRun);

      await feedback.run();
      await feedback.error();

      expect(mockOnRun).toHaveBeenCalledTimes(1);
      mathRandomSpy.mockRestore();
    });

    it('should handle errors from onRun', async () => {
      const errorOnRun = vi.fn().mockRejectedValue(new Error('Hook failed'));

      const feedback = new Feedback(false, errorOnRun);

      await expect(feedback.error()).rejects.toThrow('Hook failed');
    });
  });

  describe('forCommand', () => {
    it('should create Feedback with wasRun=true when JSON output enabled', () => {
      const mockCommand = {
        jsonEnabled: () => true,
        shouldSuppressFeedback: () => false,
        config: {
          runHook: vi.fn(),
        },
      } as any;

      const feedback = Feedback.forCommand(mockCommand);

      expect(feedback).toBeInstanceOf(Feedback);
    });

    it('should create Feedback with wasRun=true when suppress-feedback flag is set', () => {
      const mockCommand = {
        jsonEnabled: () => false,
        shouldSuppressFeedback: () => true,
        config: {
          runHook: vi.fn(),
        },
      } as any;

      const feedback = Feedback.forCommand(mockCommand);

      expect(feedback).toBeInstanceOf(Feedback);
    });

    it('should create Feedback with wasRun=false otherwise', () => {
      const mockCommand = {
        jsonEnabled: () => false,
        shouldSuppressFeedback: () => false,
        config: {
          runHook: vi.fn(),
        },
      } as any;

      const feedback = Feedback.forCommand(mockCommand);

      expect(feedback).toBeInstanceOf(Feedback);
    });

    it('should bind correct hook callback', async () => {
      const runHookMock = vi.fn().mockResolvedValue(undefined);
      const mockCommand = {
        jsonEnabled: () => false,
        shouldSuppressFeedback: () => false,
        config: {
          runHook: runHookMock,
        },
      } as any;

      const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

      const feedback = Feedback.forCommand(mockCommand);
      await feedback.run();

      expect(runHookMock).toHaveBeenCalledWith('thymian.feedback', {});
      mathRandomSpy.mockRestore();
    });
  });
});
