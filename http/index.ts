import { HttpResponseContext, RouteOptions } from "./http_context";
import { modifyResponse } from "./modify";
import { overrideResponse } from "./override";

export async function useRoute({
  route,
  request,
  page,
  modifies,
  overrides,
}: RouteOptions) {
  const context = new HttpResponseContext({
    route,
    request,
    page,
  });

  overrides && (await overrideResponse(context, overrides));

  modifies && (await modifyResponse(context, modifies));

  await context.continue();
}
