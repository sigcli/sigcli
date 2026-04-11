import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createConsoleLogger } from '../../../src/deps.js';

describe('verbose logging (#14)', () => {
  let stderrChunks: string[];

  beforeEach(() => {
    stderrChunks = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderrChunks.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('createConsoleLogger returns an object with debug, info, warn, error methods', () => {
    const logger = createConsoleLogger();
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('logger.debug writes [DEBUG] prefix to stderr', () => {
    const logger = createConsoleLogger();
    logger.debug('test message');
    expect(stderrChunks.join('')).toContain('[DEBUG] test message');
  });

  it('logger.info writes [INFO] prefix to stderr', () => {
    const logger = createConsoleLogger();
    logger.info('info message');
    expect(stderrChunks.join('')).toContain('[INFO] info message');
  });

  it('logger.warn writes [WARN] prefix to stderr', () => {
    const logger = createConsoleLogger();
    logger.warn('warning');
    expect(stderrChunks.join('')).toContain('[WARN] warning');
  });

  it('logger.error writes [ERROR] prefix to stderr', () => {
    const logger = createConsoleLogger();
    logger.error('error');
    expect(stderrChunks.join('')).toContain('[ERROR] error');
  });

  it('logger includes additional args in output', () => {
    const logger = createConsoleLogger();
    logger.debug('hello', 'world', 42);
    const output = stderrChunks.join('');
    expect(output).toContain('[DEBUG] hello world 42');
  });

  it('logger with no extra args omits trailing space', () => {
    const logger = createConsoleLogger();
    logger.info('clean');
    const output = stderrChunks.join('');
    expect(output).toBe('[INFO] clean\n');
  });
});
