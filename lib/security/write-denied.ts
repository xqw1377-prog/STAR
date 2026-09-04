export class WriteDenied extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
