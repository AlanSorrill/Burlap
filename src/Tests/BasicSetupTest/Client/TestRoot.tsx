import React from 'react'

export interface TestRoot_Props { }
export interface TestRoot_State { }
export class TestRoot extends React.Component<TestRoot_Props, TestRoot_State>{
    constructor(props: TestRoot_Props) {
        super(props);
    }
    render() {
        return <div>Hello World</div>
    }
}