module.exports = ({ env }) => ({
  i18n: {
    enabled: true,
    config: {
      defaultLocale: 'sk',
      locales: ['sk', 'cs', 'pl', 'hu', 'uk', 'en'],
    },
  },
  upload: {
    config: {
      // In production, swap for @strapi/provider-upload-aws-s3 or similar EU bucket.
      providerOptions: {
        localServer: {},
      },
      breakpoints: { xlarge: 1920, large: 1000, medium: 750, small: 500, xsmall: 64 },
    },
  },
});
