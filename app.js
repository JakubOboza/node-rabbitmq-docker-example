const amqp = require('amqplib/callback_api');
const util = require('util');
const sleep = util.promisify(setTimeout);

const RABBITMQ_HOST = process.env.RABBITMQ_HOST
const INQUEUE  = process.env.INQUEUE
const OUTQUEUE = process.env.OUTQUEUE

console.log("INQUEUE:", INQUEUE);
console.log("OUTQUEUE:", OUTQUEUE);

console.log("APP: ", "amqp://"+ RABBITMQ_HOST);

class AddDotWorker {

  process(msg) {
     console.log("%s: Adding .%s.",new Date(), msg);
     return "." + msg + ".";
  }

}

class AddPipeWorker {

  process(msg) {
     console.log("%s: Adding |%s|",new Date(), msg);
     return "|" + msg + "|";
  }

}


class RoundBracketWorker {

  process(msg) {
     console.log("%s: Adding (%s)",new Date(), msg);
     return "(" + msg + ")";
  }

}

class FunkyWorker {

  process(msg) {
     console.log("%s: Adding <%s>",new Date(), msg);
     return "<" + msg + ">";
  }

}

class Producer {

  constructor(){
    this.count = 0;
  }

  produce() {
    this.count += 1;
    return this.count + ""; // Must return string here
  }

  process(msg) {
    console.log("Job Done! Here is the result:", msg);
    return null
  }

}

console.log("Trying to create worker instance:", process.env.CALLBACKMODULE);
var worker = eval("new " + process.env.CALLBACKMODULE );
if(worker.setup){
  worker.setup()
}

class App {

  constructor(rabbit_host, inQueue, outQueue, callbackInstance){
    this.rabbit_host = rabbit_host;
    this.inQueue = inQueue;
    this.outQueue = outQueue;
    this.keepRunning = true;
    this.callbackInstance = callbackInstance;
  }

  async run() {

    amqp.connect("amqp://"+ this.rabbit_host, async (error0, connection) => {

      if (error0) {
        console.error("[AMQP]", error0.message);
        await sleep(2000);
        this.run();
      }

      connection.on("close", async function() {
        console.log("[AMQP] Connection dropped, reconnecting in 2 sec");
        await sleep(2000);
        this.run();
      });


      console.log("[AMQP] connected");
      this.rabbitConnection = connection;

      // here we attach to queue
      this.rabbitConnection.createChannel((error1, channel) => {
        if (error1) {
          throw error1;
        }

        channel.assertQueue(this.inQueue, {
          durable: false
        });

        channel.assertQueue(this.outQueue, {
          durable: false
        });

        channel.prefetch(1); // process jobs one by one

        channel.consume(this.inQueue, (msg) => {

           const response = this.callbackInstance.process(msg.content.toString());
           channel.ack(msg);

           if(response){
             channel.sendToQueue(this.outQueue, Buffer.from(response));
           }
        },{ });

        // this is just to enable producing
        if(worker.produce){
          setInterval(() =>  {
            const msg = this.callbackInstance.produce();
            console.log("Producing:", msg);
            channel.sendToQueue(this.outQueue, Buffer.from(msg));
          }, 3000);
        }

      });
    });
  }


}

const app = new App(RABBITMQ_HOST, INQUEUE, OUTQUEUE, worker);
app.run();

