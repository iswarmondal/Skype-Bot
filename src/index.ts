import * as path from "path";

import { config } from "dotenv";
const ENV_FILE = path.join(__dirname, "..", ".env");
config({ path: ENV_FILE });

import * as restify from "restify";

import { INodeSocket } from "botframework-streaming";

import {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  ConversationParameters,
  MessageFactory,
  createBotFrameworkAuthenticationFromConfiguration,
} from "botbuilder";

import { EchoBot } from "./bot";

const server = restify.createServer();
server.use(restify.plugins.bodyParser());

server.listen(process.env.port || process.env.PORT || 3978, () => {
  console.log(`\n${server.name} listening to ${server.url}`);
  console.log(
    "\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator"
  );
  console.log('\nTo talk to your bot, open the emulator select "Open Bot"');
});

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: process.env.MicrosoftAppId,
  MicrosoftAppPassword: process.env.MicrosoftAppPassword,
  MicrosoftAppType: process.env.MicrosoftAppType,
  MicrosoftAppTenantId: process.env.MicrosoftAppTenantId,
});

const botFrameworkAuthentication =
  createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);
const adapter = new CloudAdapter(botFrameworkAuthentication);
const onTurnErrorHandler = async (
  context: {
    sendTraceActivity: (
      arg0: string,
      arg1: string,
      arg2: string,
      arg3: string
    ) => any;
    sendActivity: (arg0: string) => any;
  },
  error: any
) => {
  console.error(`\n [onTurnError] unhandled error: ${error}`);

  await context.sendTraceActivity(
    "OnTurnError Trace",
    `${error}`,
    "https://www.botframework.com/schemas/error",
    "TurnError"
  );

  // Send a message to the user
  await context.sendActivity("The bot encountered an error or bug.");
  await context.sendActivity(
    "To continue to run this bot, please fix the bot source code."
  );
};
adapter.onTurnError = onTurnErrorHandler;
const myBot = new EchoBot();

server.post("/api/messages", async (req, res) => {
  await adapter.process(req, res, (context) => myBot.run(context));
});

server.post("/api/send-this-message", async (req, res) => {
  const { message } = req.body;

  const conversationParameters: ConversationParameters = {
    isGroup: false,
    bot: {
      id: "5f6f65a0-9efb-11ee-b25a-27da116b39b2",
      name: "Bot",
    },
    activity: undefined,
    channelData: {
      clientActivityID: "17030568806384u83gouhkp6",
    },
  };

  try {
    await adapter.createConversationAsync(
      process.env.MicrosoftAppId,
      "emulator",
      "http://localhost:49807/",
      "audience",
      conversationParameters,
      async (turnContext) => {
        await turnContext.sendActivity(message);
      }
    );
    res.json({ success: true, message: "Message sent successfully." });
  } catch (error) {
    res.json({ success: false, error });
  }
});

server.on("upgrade", async (req, socket, head) => {
  const streamingAdapter = new CloudAdapter(botFrameworkAuthentication);

  streamingAdapter.onTurnError = onTurnErrorHandler;

  await streamingAdapter.process(
    req,
    socket as unknown as INodeSocket,
    head,
    (context) => myBot.run(context)
  );
});
