declare module 'textmagic-rest-client' {
  interface TMClientResponse {
    id?: string | number
    messageId?: string | number
    [key: string]: any
  }

  interface TMUserResponse {
    balance?: number
    currency?: string
    [key: string]: any
  }

  interface TMMessages {
    send(
      data: {
        text: string
        phones: string
        from?: string
        [key: string]: any
      },
      callback: (error: any, response: TMClientResponse) => void
    ): void
  }

  interface TMUser {
    getCurrent(
      callback: (error: any, response: TMUserResponse) => void
    ): void
  }

  class TMClient {
    Messages: TMMessages
    User: TMUser

    constructor(username: string, apiKey: string)
  }

  export = TMClient
}