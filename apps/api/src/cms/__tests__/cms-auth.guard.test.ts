import { ConfigService } from '@nestjs/config';
import { CmsAuthGuard } from '../cms-auth.guard';

function ctx(): any {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  };
}

describe('CmsAuthGuard', () => {
  it('short-circuits to allow when CMS_AUTH_BYPASS=true', () => {
    const cfg = { get: () => 'true' } as unknown as ConfigService;
    const guard = new CmsAuthGuard(cfg);
    expect(guard.canActivate(ctx())).toBe(true);
  });

  it('does NOT short-circuit when CMS_AUTH_BYPASS is false (delegates to passport JWT)', () => {
    const cfg = { get: () => 'false' } as unknown as ConfigService;
    const guard = new CmsAuthGuard(cfg);
    // With bypass off the guard hands control to AuthGuard('jwt'); the result is
    // therefore NOT the synchronous `true` of the bypass branch. We assert the
    // delegation occurs without exercising passport's request internals.
    const superSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue('DELEGATED' as never);
    expect(guard.canActivate(ctx())).toBe('DELEGATED');
    superSpy.mockRestore();
  });
});
