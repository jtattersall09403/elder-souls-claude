export const commonArgs = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--ignore-gpu-blocklist',
  '--enable-gpu-rasterization',
  '--enable-zero-copy',
  '--disable-software-rasterizer',
  '--force-color-profile=srgb',
];

const vulkanFeatures = '--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE';

export const launchCandidates = [
  {
    name: 'angle-vulkan-x11',
    args: ['--use-gl=angle', '--use-angle=vulkan', vulkanFeatures, '--ozone-platform=x11'],
  },
  {
    name: 'angle-vulkan-surfaceless',
    args: ['--use-gl=angle', '--use-angle=vulkan', vulkanFeatures, '--disable-vulkan-surface'],
  },
  { name: 'angle-gl-egl', args: ['--use-gl=angle', '--use-angle=gl-egl'] },
  { name: 'angle-gl', args: ['--use-gl=angle', '--use-angle=gl'] },
  { name: 'native-default', args: [] },
];

export const softwareRenderer = /swiftshader|llvmpipe|software raster|softpipe/i;
