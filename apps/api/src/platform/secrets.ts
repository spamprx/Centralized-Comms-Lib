export interface SecretProvider {
  get(name: string): string | undefined;
  require(name: string): string;
}

class EnvSecretProvider implements SecretProvider {
  get(name: string): string | undefined {
    return process.env[name];
  }

  require(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required secret: ${name}`);
    }
    return value;
  }
}

export const secretProvider: SecretProvider = new EnvSecretProvider();
