/**
 * @module botbuilder
 */
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import {
  Activity,
  ActivityTypes
} from 'botframework-schema';
import {
  ActivityHandler,
  Middleware,
  MiddlewareHandler,
  TurnContext
} from 'botbuilder-core';
import {
  BotFrameworkAdapterSettings,
  InvokeResponse
} from './botFrameworkAdapter';
import { IStreamingTransportServer, ReceiveRequest, RequestHandler, StreamingResponse, NamedPipeServer, WebSocketServer } from 'botframework-streaming-extensions';
import * as os from 'os';
// tslint:disable-next-line: no-require-imports
const pjson: any = require('../package.json');
import { BotFrameworkStreamingAdapter } from './BotFrameworkStreamingAdapter';
import { ISocket } from 'botframework-streaming-extensions/lib/WebSocket/ISocket';

export class StreamingRequestHandler implements RequestHandler {
  public bot: ActivityHandler;
  public adapterSettings: BotFrameworkAdapterSettings;
  public logger;
  public server: IStreamingTransportServer;
  public adapter: BotFrameworkStreamingAdapter;
  public middleWare: (MiddlewareHandler|Middleware)[];

  constructor(bot: ActivityHandler, logger?, settings?: BotFrameworkAdapterSettings, middleWare?: (MiddlewareHandler|Middleware)[]) {

    if (bot === undefined) {
      throw new Error('Undefined Argument: Bot can not be undefined.');
    } else {
      this.bot = bot;
    }

    if (logger === undefined) {
      this.logger = console;
    } else {
      this.logger = logger;
    }

    this.adapterSettings = settings;
    this.middleWare = middleWare;
  }

  public async startNamedPipeAsync(pipename: string){
    this.server = new NamedPipeServer(pipename, this);
    this.adapter = new BotFrameworkStreamingAdapter(this.server, this.adapterSettings);
    await this.server.startAsync();
  }

  public async startWebSocketAsync(socket: ISocket){
    this.server = new WebSocketServer(socket, this);
    this.adapter = new BotFrameworkStreamingAdapter(this.server, this.adapterSettings);
    await this.server.startAsync();
  }

  public async processRequestAsync(request: ReceiveRequest): Promise<StreamingResponse> {

    let response = new StreamingResponse();
    let body = await this.readRequestBodyAsString(request);
    if (body === undefined || request.Streams === undefined) {
      response.statusCode = 400;
      this.logger.log('Request missing body and/or streams.');

      return response;
    }

    if (!request || !request.Verb || !request.Path) {
      response.statusCode = 400;
      this.logger.log('Request missing verb and/or path.');

      return response;
    }

    if (request.Verb.toLocaleUpperCase() === 'GET' && request.Path.toLocaleLowerCase() === '/api/version') {
      response.statusCode = 200;
      response.setBody(this.getUserAgent());

      return response;
    }

    if (request.Verb.toLocaleUpperCase() !== 'POST') {
      response.statusCode = 405;

      return response;
    }

    if (request.Path.toLocaleLowerCase() !== '/api/messages') {
      response.statusCode = 404;

      return response;
    }

    try {
      let activity: Activity = body;
      let adapter: BotFrameworkStreamingAdapter = new BotFrameworkStreamingAdapter(this.server, this.adapterSettings);
      this.middleWare.forEach(mw => {
        adapter.use(mw);
      });
      let context = new TurnContext(adapter, activity);
      await adapter.executePipeline(context, async (turnContext) => {
        await this.bot.run(turnContext);
      });

      if (activity.type === ActivityTypes.Invoke) {
        // tslint:disable-next-line: no-backbone-get-set-outside-model
        let invokeResponse: any = context.turnState.get('BotFrameworkStreamingAdapter.InvokeResponse');

        if (invokeResponse && invokeResponse.value) {
          const value: InvokeResponse = invokeResponse.value;
          response.statusCode = value.status;
          response.setBody(value.body);
        } else {
          response.statusCode = 501;
        }
      } else {
        response.statusCode = 200;
      }
    } catch (error) {
      response.statusCode = 500;
      this.logger.log(error);

      return response;

    }

    return response;
  }

  public async readRequestBodyAsString(request: ReceiveRequest): Promise<Activity> {
    if (request.Streams !== undefined && request.Streams[0] !== undefined) {
      let contentStream =  request.Streams[0];
      try {
        return await contentStream.readAsJson<Activity>();
      } catch (error) {
        this.logger.log(error);
      }
    }

    return;
  }

  private getUserAgent(): string {
    const ARCHITECTURE: any = os.arch();
    const TYPE: any = os.type();
    const RELEASE: any = os.release();
    const NODE_VERSION: any = process.version;

    return `Microsoft-BotFramework/3.1 BotBuilder/${ pjson.version } ` +
        `(Node.js,Version=${ NODE_VERSION }; ${ TYPE } ${ RELEASE }; ${ ARCHITECTURE })`;
  }
}
