import { describe, it, expect } from 'vitest';
import { cn, buttonVariants } from '../index.js';

describe('@platform/ui component primitives', () => {
  it('combines tailwind classes using cn utility', () => {
    const result = cn('px-2 py-1', 'bg-blue-500', { 'text-white': true });
    expect(result).toContain('px-2');
    expect(result).toContain('bg-blue-500');
    expect(result).toContain('text-white');
  });

  it('generates button variants correctly', () => {
    const defaultBtnClass = buttonVariants({ variant: 'default', size: 'default' });
    expect(defaultBtnClass).toContain('bg-primary');

    const destructiveBtnClass = buttonVariants({ variant: 'destructive', size: 'sm' });
    expect(destructiveBtnClass).toContain('bg-destructive');
    expect(destructiveBtnClass).toContain('h-8');
  });
});
