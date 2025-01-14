import type { IRouter } from "express";

export default class RouteCollector {
    private static routes: string[] = [];

    public static getAllRoutes(): string[] {
        return this.routes;
    }

    public static collectFromRouter(router: IRouter, prefix = ""): void {
        router.stack.forEach((layer: any) => {
            if (layer.route) {
                const methods = Object.keys(layer.route.methods)
                    .map((method) => method.toUpperCase())
                    .join(", ");
                this.addRouteToCollection(`${methods} ${prefix}${layer.route.path}`);
            } else if (layer.name === "router" && layer.handle.stack) {
                const matchedPath = this.extractPathFromRegexp(layer.regexp);
                this.collectFromRouter(layer.handle, `${prefix}${matchedPath}`);
            }
        });
    }

    private static addRouteToCollection(route: string): void {
        this.routes.push(route);
    }

    private static extractPathFromRegexp(regexp: RegExp): string {
        const match = regexp
            .toString()
            .replace(/^\/\^/, "")
            .replace(/\\\/\?/, "")
            .replace(/\(\?\=.+$/, "")
            .replace(/\\(.)/g, "$1");
        return match.startsWith("/") ? match : `/${match}`;
    }
}
