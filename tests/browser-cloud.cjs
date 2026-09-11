const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const assert = require("node:assert/strict");
const fs = require("fs");
const users = {
  a: {
    id: "a0000000-0000-4000-8000-000000000001",
    email:
      "a.very.long.account.address.for.sidebar.truncation.and.mobile.navigation@a-long-example-domain.example.com",
    aud: "authenticated",
    role: "authenticated",
  },
  b: {
    id: "b0000000-0000-4000-8000-000000000002",
    email: "b@example.com",
    aud: "authenticated",
    role: "authenticated",
  },
};
const jwt = (u) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: u.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
      }),
    ).toString("base64url"),
    "mock_signature",
  ].join(".");
const session = (u) => ({
  access_token: jwt(u),
  refresh_token: "refresh-" + u.id,
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: u,
});
const base = {
  version: 1,
  demo: false,
  categories: [
    {
      id: "c0000000-0000-4000-8000-000000000001",
      name: "Food & dining",
      type: "expense",
      color: "#26876b",
      icon: 0,
    },
    {
      id: "c0000000-0000-4000-8000-000000000002",
      name: "Salary",
      type: "income",
      color: "#26876b",
    },
  ],
  transactions: [],
  budgets: [],
  settings: { currency: "PHP" },
};
const stores = {
  a: { revision: 1, imports: [], data: structuredClone(base) },
  b: { revision: 1, imports: [], data: structuredClone(base) },
};
const legacy = {
  ...structuredClone(base),
  transactions: [
    {
      id: "legacy-t",
      type: "expense",
      amount: 12345,
      categoryId: base.categories[0].id,
      date: "2026-09-08",
      note: "Local legacy expense",
    },
  ],
};
let failSave = false,
  delayLoad = false;
const errors = [];
(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://dinero-test.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    let body = {};
    try {
      body = req.postDataJSON() || {};
    } catch {}
    const respond = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (url.pathname.endsWith("/token"))
      return respond(session(body.email?.startsWith("b") ? users.b : users.a));
    if (url.pathname.endsWith("/logout")) return respond({});
    if (url.pathname.endsWith("/signup"))
      return respond({ user: users.a, session: null });
    if (url.pathname.endsWith("/recover") || url.pathname.endsWith("/resend"))
      return respond({});
    if (url.pathname.endsWith("/user")) return respond(users.a);
    const auth = req.headers().authorization || "";
    const tokenPayload = JSON.parse(
      Buffer.from(auth.split(".")[1], "base64url").toString(),
    );
    const who = tokenPayload.sub === users.b.id ? "b" : "a";
    if (url.pathname.endsWith("/load_workspace")) {
      if (delayLoad) await new Promise((r) => setTimeout(r, 500));
      return respond(stores[who]);
    }
    if (url.pathname.endsWith("/save_workspace")) {
      if (failSave) {
        failSave = false;
        return respond(
          { message: "Simulated network save failure", code: "P0001" },
          500,
        );
      }
      if (body.import_hash && stores[who].imports.includes(body.import_hash))
        return respond({ message: "already_imported" }, 400);
      if (body.expected_revision !== stores[who].revision)
        return respond({ message: "revision_conflict" }, 409);
      stores[who] = {
        data: body.payload,
        revision: stores[who].revision + 1,
        imports: body.import_hash
          ? [...stores[who].imports, body.import_hash]
          : stores[who].imports,
      };
      return respond(stores[who]);
    }
    throw Error("Unexpected mocked request " + url.pathname);
  });
  await page.goto("http://127.0.0.1:5174");
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Dashboard", exact: true }).count(),
    0,
  );
  await page.evaluate(
    (d) => localStorage.setItem("dinero:v1", JSON.stringify(d)),
    legacy,
  );
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("a@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("Password123!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Check your email" })
    .waitFor();
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email", { exact: true }).fill("a@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "If an account exists" })
    .waitFor();
  await page.getByRole("button", { name: "Back to sign in" }).click();
  async function login(email) {
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("heading", { name: "Your money, at a glance." })
      .waitFor();
  }
  await login("a@example.com");
  assert.equal(stores.a.data.transactions.length, 0);
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .first()
    .click();
  await page.getByLabel("Amount (PHP)").fill("200.50");
  await page.getByLabel("Note").fill("Private A expense");
  failSave = true;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("alert")
    .filter({ hasText: "Simulated" })
    .waitFor();
  assert.equal(stores.a.data.transactions.length, 0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page.getByText("Private A expense", { exact: true }).waitFor();
  assert.equal(stores.a.data.transactions[0].amount, 20050);
  await page.reload();
  await page.getByText("Private A expense", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Edit Private A expense", exact: true })
    .click();
  await page.getByLabel("Amount (PHP)").fill("300.75");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(stores.a.data.transactions[0].amount, 30075);
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await page.getByRole("button", { name: "Set budget", exact: true }).click();
  await page.getByLabel("Monthly spending limit (PHP)").fill("1000");
  await page.getByRole("button", { name: "Save budget", exact: true }).click();
  await page.getByText("30% used", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Categories", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Food & dining", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "This category is used" })
    .waitFor();
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Travel");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await page.getByRole("heading", { name: "Travel", exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit Travel", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Trips");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete Trips", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(stores.a.data.categories.length, 2);
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await page.getByLabel("Search transactions").fill("no match");
  await page
    .getByRole("heading", { name: "No transactions here yet" })
    .waitFor();
  await page.getByLabel("Search transactions").fill("");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Currency preference").selectOption("USD");
  await page.waitForFunction(
    () =>
      document.querySelector('select[aria-label="Currency preference"]')
        .value === "USD",
  );
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  assert.equal(
    await page.getByLabel("Currency preference").inputValue(),
    "USD",
  );
  await page.getByLabel("Currency preference").selectOption("PHP");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON backup" }).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  assert.equal(exported.transactions[0].amount, 30075);
  exported.transactions[0].note = "Restored JSON expense";
  await page.getByLabel("Import JSON backup").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Backup restored and verified in your cloud account." })
    .waitFor();
  assert.equal(stores.a.data.transactions[0].note, "Restored JSON expense");
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  const beforeFilters=JSON.stringify(stores.a);
  const transactionDay=Number(stores.a.data.transactions[0].date.slice(8))-1;
  await page.getByLabel('Income vs expenses interval').selectOption(String(transactionDay));
  assert.match(await page.locator('.analytics-chart').filter({has:page.getByRole('heading',{name:'Income vs expenses',exact:true})}).locator('.chart-exact').textContent(),/300\.75/);
  await page.getByLabel('Analytics period').selectOption('custom');
  await page.getByLabel('Start date',{exact:true}).fill('2024-02-01');
  await page.getByLabel('End date',{exact:true}).fill('2024-02-29');
  await page.getByRole('button',{name:'Apply range',exact:true}).click();
  await page.getByRole('heading',{name:'No activity during this period.',exact:true}).waitFor();
  await page.getByLabel('Analytics period').selectOption('thisMonth');
  await page.getByLabel('Group chart data by').selectOption('week');
  await page.getByLabel('Group chart data by').selectOption('month');
  await page.getByLabel('Group chart data by').selectOption('day');
  const trend=page.locator('.analytics-chart').filter({has:page.getByRole('heading',{name:'Income vs expenses',exact:true})});
  await trend.getByRole('button',{name:'Line',exact:true}).click();
  await trend.getByRole('button',{name:'Bar',exact:true}).click();
  const categoryChart=page.locator('.analytics-chart').filter({has:page.getByRole('heading',{name:'Spending by category',exact:true})});
  const categoryAmounts=await categoryChart.locator('.analytics-category-list').allTextContents();
  await categoryChart.getByRole('button',{name:'Bar',exact:true}).click();
  await categoryChart.getByRole('button',{name:'Donut',exact:true}).click();
  assert.deepEqual(await categoryChart.locator('.analytics-category-list').allTextContents(),categoryAmounts);
  await categoryChart.getByRole('button',{name:'View Food & dining transactions',exact:true}).click();
  assert.equal(await page.getByLabel('Filter by type').inputValue(),'expense');
  assert.equal(await page.getByLabel('Filter by category').inputValue(),stores.a.data.categories.find(c=>c.name==='Food & dining').id);
  await page.getByLabel('Minimum amount').fill('400');
  await page.getByRole('heading',{name:'No transactions here yet'}).waitFor();
  await page.getByLabel('Maximum amount').fill('200');
  await page.getByRole('alert').filter({hasText:'Minimum amount cannot exceed'}).waitFor();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.getByLabel('Minimum amount').fill('300.75');
  await page.getByLabel('Maximum amount').fill('300.75');
  await page.getByLabel('Search transactions').fill('Restored JSON');
  for(const sort of ['highest','lowest','oldest','newest'])await page.getByLabel('Sort transactions').selectOption(sort);
  await page.getByText('Restored JSON expense',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  assert.equal(JSON.stringify(stores.a),beforeFilters,'Filtering and chart switches must not write cloud data');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Open account menu" });
    await trigger.click();
    const menu = page.getByRole("menu", { name: "Account", exact: true });
    await menu.waitFor();
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    assert.equal(
      await page.locator(".account-menu-identity strong").textContent(),
      users.a.email,
    );
    assert.equal(
      await page.locator(".account-dropdown").evaluate((el) => {
        const box = el.getBoundingClientRect();
        return (
          box.left >= 0 &&
          box.right <= innerWidth &&
          el.scrollWidth <= el.clientWidth
        );
      }),
      true,
    );
    await page.screenshot({
      path: `${require("node:os").tmpdir()}/dinero-account-${width}.png`,
    });
    await page.keyboard.press("ArrowDown");
    assert.equal(
      await page
        .getByRole("menuitem", { name: "Settings", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("End");
    assert.equal(
      await page
        .getByRole("menuitem", { name: "Sign out", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Home");
    await page.keyboard.press("Escape");
    assert.equal(await menu.count(), 0);
    assert.equal(
      await trigger.evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("ArrowUp");
    assert.equal(
      await page
        .getByRole("menuitem", { name: "Sign out", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Tab");
    assert.equal(await menu.count(), 0);
    await trigger.click();
    await page.mouse.click(2, 2);
    assert.equal(await menu.count(), 0);
    await trigger.click();
    await page.getByRole("menuitem", { name: "Profile / Account" }).click();
    assert.equal(await menu.count(), 0);
    await page.waitForFunction(
      () => document.activeElement?.id === "account-heading",
    );
    await trigger.click();
    await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
    await page.waitForFunction(
      () => document.activeElement?.id === "page-title",
    );
    assert.equal(await menu.count(), 0);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    if (width > 900) {
      assert.equal(
        await page.locator(".profile .account-email").getAttribute("title"),
        users.a.email,
      );
      assert.equal(
        await page
          .locator(".profile .account-email")
          .evaluate(
            (el) =>
              getComputedStyle(el).whiteSpace === "nowrap" &&
              getComputedStyle(el).textOverflow === "ellipsis" &&
              el.scrollWidth > el.clientWidth,
          ),
        true,
      );
      assert.equal(
        await page.locator(".profile").evaluate((el) => {
          const avatar = el.querySelector(".avatar").getBoundingClientRect();
          const status = el
            .querySelector(".online-dot")
            .getBoundingClientRect();
          return (
            avatar.width === 35 &&
            status.right <= el.getBoundingClientRect().right
          );
        }),
        true,
      );
    }
  }
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    for (const name of [
      "Dashboard",
      "Transactions",
      "Categories",
      "Budget",
      "Settings",
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `${require("node:os").tmpdir()}/dinero-cloud-${width}-${name}.png`,
        fullPage: true,
      });
    }
    for (const [nav, button] of [
      ["Transactions", "Add transaction"],
      ["Categories", "Add category"],
    ]) {
      await page.getByRole("button", { name: nav, exact: true }).click();
      await page
        .getByRole("button", { name: button, exact: true })
        .first()
        .click();
      await page.getByRole("dialog").waitFor();
      assert.equal(
        await page
          .getByRole("dialog")
          .evaluate((e) => e.scrollWidth > e.clientWidth),
        false,
      );
      await page.screenshot({
        path: `${require("node:os").tmpdir()}/dinero-cloud-${width}-${nav}-form.png`,
      });
      await page.getByRole("button", { name: "Close dialog" }).click();
    }
  }
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Review local import" }).click();
  await page
    .getByRole("dialog")
    .getByText("Account:", { exact: false })
    .waitFor();
  await page.getByRole("button", { name: "Replace cloud data" }).click();
  await page
    .getByText("Local import verified in the cloud.", { exact: false })
    .waitFor();
  assert.equal(stores.a.data.transactions[0].amount, 12345);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("dinero:v1")).transactions[0].id,
    ),
    "legacy-t",
  );
  await page.getByRole("button", { name: "Review local import" }).click();
  await page
    .getByText("This local backup has already been imported", { exact: false })
    .waitFor();
  assert.equal(stores.a.data.transactions.length, 1);
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  assert.equal(
    await page.getByText("Local legacy expense", { exact: true }).count(),
    0,
  );
  delayLoad = true;
  await login("b@example.com");
  assert.equal(
    await page.getByText("Local legacy expense", { exact: true }).count(),
    0,
  );
  assert.equal(stores.b.data.transactions.length, 0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  // A real reset email would return this fragment; response is mocked here only.
  const recovery = session(users.a);
  await page.goto(
    "http://127.0.0.1:5174/?auth=reset#access_token=" +
      recovery.access_token +
      "&refresh_token=" +
      recovery.refresh_token +
      "&expires_in=3600&token_type=bearer&type=recovery",
  );
  await page.getByRole("heading", { name: "Choose a new password." }).waitFor();
  await page.getByLabel("Password", { exact: true }).fill("NewPassword123!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("NewPassword123!");
  await page.getByRole("button", { name: "Update password" }).click();
  await page
    .getByRole("heading", { name: "Your money, at a glance." })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "MOCK browser checks passed: protected workspace, signup confirmation, forgot/reset, signin/refresh/signout/account switch, failed save stays open, retry, explicit local import/dedupe/backup preservation, five pages and forms at desktop/mobile.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
