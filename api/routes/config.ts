import { Router, Request, Response } from 'express';
import { resetClient, getEmagClient, getPlatform, getUsername } from '../middleware/emagClient';
import { Emag, Platform } from '../../src';

const router = Router();

let dynamicCredentials: {
  username?: string;
  password?: string;
  platform?: Platform;
} | null = null;

export const getDynamicCredentials = () => dynamicCredentials;
export const isUsingDynamicCredentials = () => dynamicCredentials !== null;

router.get('/', (req: Request, res: Response) => {
  const usingDynamic = isUsingDynamicCredentials();
  res.json({
    success: true,
    data: {
      mode: usingDynamic ? 'dynamic' : 'environment',
      platform: getPlatform(),
      username: getUsername(),
      dynamicCredentialsConfigured: usingDynamic,
    },
  });
});

router.post('/credentials', (req: Request, res: Response) => {
  const { username, password, platform } = req.body;

  if (!username || !password) {
    res.status(400).json({
      success: false,
      error: 'Missing required credentials (username, password)',
    });
    return;
  }

  const p = platform || 'ro';
  if (!['ro'].includes(p)) {
    res.status(400).json({
      success: false,
      error: 'Invalid platform. Must be "ro"',
    });
    return;
  }

  try {
    dynamicCredentials = { username, password, platform: p as Platform };

    process.env.EMAG_USERNAME = username;
    process.env.EMAG_PASSWORD = password;
    process.env.EMAG_PLATFORM = p;

    resetClient();

    const newUsername = getUsername();
    const newPlatform = getPlatform();

    console.log(`[Config] Credentials updated: platform=${newPlatform}, username=${newUsername}`);

    res.json({
      success: true,
      message: 'Credentials updated successfully',
      data: {
        username: newUsername,
        platform: newPlatform,
      },
    });
  } catch (error: any) {
    console.error('[Config] Error updating credentials:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update credentials',
    });
  }
});

router.delete('/credentials', (req: Request, res: Response) => {
  dynamicCredentials = null;
  resetClient();
  res.json({
    success: true,
    message: 'Dynamic credentials cleared, reverted to environment variables',
    data: {
      username: getUsername(),
      platform: getPlatform(),
    },
  });
});

router.post('/test', async (req: Request, res: Response) => {
  const { username, password, platform } = req.body;

  if (!username || !password) {
    res.status(400).json({
      success: false,
      error: 'Missing required credentials (username, password)',
    });
    return;
  }

  try {
    const testClient = new Emag(username, password, (platform as Platform) || 'ro');
    const result = await testClient.getCategories({ currentPage: 1, itemsPerPage: 1 });

    res.json({
      success: !result.isError,
      message: result.isError ? 'Connection failed' : 'Connection successful',
      data: {
        isError: result.isError,
        messages: result.messages,
        categoriesFound: result.results?.length || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Connection test failed',
    });
  }
});

export default router;
