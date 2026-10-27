/**
 * The log contract's install, imported right after the demo guard and before
 * anything else: `feedbackTrace` and every axios client must find the
 * contract's console and interceptors already in place.
 */
import { installOnsellLog } from './onsellLog';

installOnsellLog({ service: 'emag' });
