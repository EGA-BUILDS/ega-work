import { expect, test } from './fixtures';

test.describe('Public routes', () => {
   test('P01: homepage renders correctly', async ({ page }) => {
      await page.goto('/');

      await expect(
         page.getByRole('heading', { level: 1, name: 'The work, in one clear record.' })
      ).toBeVisible();
      await expect(page).toHaveTitle(/EGA Work/);
      await expect(page.getByText('Early preview', { exact: true })).toBeVisible();
   });

   test('P02: login and demo pages render correctly', async ({ page }) => {
      await page.goto('/login');

      await expect(
         page.getByRole('heading', { level: 1, name: 'Sign in to EGA Work' })
      ).toBeVisible();
      const passwordForm = page.locator('form', {
         has: page.getByRole('button', { name: 'Sign in with password' }),
      });
      await expect(passwordForm.getByLabel('Email address')).toBeVisible();
      await expect(passwordForm.getByLabel('Password')).toBeVisible();

      await page.goto('/demo');

      await expect(page.getByRole('heading', { level: 1, name: 'Work overview' })).toBeVisible();
   });

   test('P03: anonymous access to a private workspace route redirects to login', async ({
      page,
   }) => {
      await page.goto('/w/00000000-0000-0000-0000-000000000000/projects');

      // The redirect must happen before any workspace content is shown.
      await expect(page).toHaveURL(/\/login(\?|$)/);
      await expect(
         page.getByRole('heading', { level: 1, name: 'Sign in to EGA Work' })
      ).toBeVisible();
   });

   test('P04: unknown nested route returns an actual HTTP 307 redirect to /', async ({
      request,
      baseURL,
   }) => {
      const response = await request.get('/this-route-does-not-exist/nested/p04-e2e', {
         maxRedirects: 0,
      });

      expect(response.status()).toBe(307);

      const location = response.headers()['location'];
      expect(location, 'Location header must be present on a redirect').toBeTruthy();

      const base = new URL(baseURL ?? 'http://localhost:3000');
      const resolved = new URL(location as string, base);
      expect(resolved.origin).toBe(base.origin);
      expect(resolved.pathname).toBe('/');
   });
});
