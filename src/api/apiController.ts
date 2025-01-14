import ProfileService from "../services/internal/profile.js";
import { PROFILE_ROLE, RELATIONSHIP } from "../constants.js";
import AccessControlService from "../services/external/accessControl.js";

import ForbiddenError from "../errors/ForbiddenError.js";

import type { IResponse } from "../interfaces/api/response.js";
import type { Request, Response, NextFunction } from "express";

type IRoleRelationshipPairs = {
    role: PROFILE_ROLE;
    relationships: RELATIONSHIP[];
};

export default class ApiController {
    public static callbackFactory<Params, ReqPayload extends { body?: any; query?: any }, ResBody>(config: {
        action: string;
        roleRelationshipPairs: IRoleRelationshipPairs[];
        /** "*" means all */
        toId:
            | string
            | ((req: Request<Params, {}, ReqPayload["body"], ReqPayload["query"]>) => string | Promise<string>);
        callback: (
            req: Request<Params, {}, ReqPayload["body"], ReqPayload["query"]>,
            res: Response<IResponse<ResBody>>,
            next: NextFunction
        ) => unknown;
    }) {
        const { action, roleRelationshipPairs, toId, callback } = config;

        if ((toId === "*" && roleRelationshipPairs.length > 0) || (roleRelationshipPairs.length === 0 && toId !== "*"))
            throw new Error("Invalid configuration");
        const needAuthorize = roleRelationshipPairs.length > 0 && toId !== "*";
        needAuthorize &&
            roleRelationshipPairs.forEach(({ role, relationships }) => {
                AccessControlService.roleRegistry(role, action, relationships);
            });

        const authorizeMiddleware = needAuthorize
            ? async (
                  req: Request<Params, {}, ReqPayload["body"], ReqPayload["query"]>,
                  res: Response<IResponse<ResBody>>,
                  next: NextFunction
              ) => {
                  try {
                      const user = req.ctx.user;
                      const fromId = req.ctx.profileId;

                      if (!fromId) throw new ForbiddenError();
                      const [profile] = await Promise.all([
                          ProfileService.getByProfileUserIds(fromId, user._id).then((result) => {
                              if (!result) throw new ForbiddenError();
                              return result;
                          }),
                          ApiController.authorize(
                              `${fromId}`,
                              typeof toId === "string" ? toId : await toId(req),
                              action
                          ),
                      ]);

                      req.ctx.profile = profile;

                      next();
                  } catch (err) {
                      next(err);
                  }
              }
            : undefined;

        return [authorizeMiddleware, callback].filter((e) => e !== undefined);
    }

    private static async authorize(fromId: string, toId: string, action: string) {
        const result = await AccessControlService.authorize(fromId, toId, action);
        if (!result) throw new ForbiddenError();
    }
}
