declare global {
  interface Window {
    hermes: {
      send: (prompt: string) => void;
    };
  }
}
export {};
