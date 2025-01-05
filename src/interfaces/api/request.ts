export interface IOffsetPagination {
    page?: number;
    limit?: number;
}

export interface ITimeBasedPagination {
    from?: Date;
    limit?: number;
}

// Profile
export namespace IReqProfile {
    export interface Insert {}

    export interface Update {}
}
