# Hot Dev Demo: Send My News

In this demo, the `send-my-news` function takes a preset list of AI news websites, fetches them in parallel, summarizes them with Anthropic Claude, and then sends an email of the top AI news links of the day via Resend.  This is a scheduled function that runs every morning or on-demand if I send the corresponding `send-my-news-now` event.  Notice how little boilerplate Hot needs?  Hot is very expressive!

## Run this on your local machine

### Install Hot Dev

https://hot.dev/download

### Run Hot Dev

```sh
git clone https://github.com/hot-dev/hot-demos
cd hot-demos/my-news
hot dev
```

Hint: use `hot dev --open` to open the Hot Dev App in a browser.

### Configure It

1. Use the app to add your Context Variables for `anthropic.api.key` and `resend.api.key`.  This process is similar for production.  For local development, you can also use a `hot/ctx.hot` file (ignored by git) with the following contents:

```hot
::hot::run::ctx ns

::hot::ctx/set({
    // =========================================================================
    // AI Services - Set your API keys here
    // =========================================================================

    // Anthropic Claude (streaming supported)
    "anthropic.api.key": ::hot::env/get("ANTHROPIC_API_KEY", ""),

    // Resend (email service)
    "resend.api.key": ::hot::env/get("RESEND_API_KEY", "")

})
```

2. Change the from and to emails in the `hot/src/demo/my-news.hot` file to appropriate values for you.


### Trigger It

Leave `hot dev` running and wait until the daily schedule triggers.

Ha, NO, don't do that.  Change the schedule to "every 5 minutes" and see it trigger via schedule.

OR, you can trigger it manually by using `send` to send the event.  Notice this has no event data `{}`.

```sh
hot eval 'send("send-my-news-now", {})'
```
