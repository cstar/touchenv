import { createInterface } from 'node:readline';

/**
 * Prompt for a password from the terminal (hides input).
 * Falls back to TOUCHENV_PASSWORD env var for non-interactive (CI) use.
 */
export async function promptPassword(message: string): Promise<string> {
  const envPassword = process.env['TOUCHENV_PASSWORD'];
  if (envPassword) {
    return envPassword;
  }

  if (!process.stdin.isTTY) {
    throw new Error('No TTY available for password prompt. Set TOUCHENV_PASSWORD for non-interactive use.');
  }

  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });

    rl.question(message, (answer) => {
      rl.close();
      process.stderr.write('\n');
      if (!answer) {
        reject(new Error('Password cannot be empty'));
        return;
      }
      resolve(answer);
    });

    // Mute the output to hide typed characters
    const origWrite = (rl as any).output.write;
    (rl as any).output.write = function (chunk: string) {
      // Only write the prompt, not the typed characters
      if (chunk === message) {
        return origWrite.call(this, chunk);
      }
      // Suppress echoed characters but allow newlines
      if (chunk === '\r\n' || chunk === '\n') {
        return origWrite.call(this, chunk);
      }
      return true;
    };
  });
}

/**
 * Prompt for a password with confirmation (for export).
 */
export async function promptPasswordWithConfirm(): Promise<string> {
  const password = await promptPassword('Password: ');
  const confirm = await promptPassword('Confirm password: ');

  if (password !== confirm) {
    throw new Error('Passwords do not match');
  }

  return password;
}
