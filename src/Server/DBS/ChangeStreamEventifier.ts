import { ChangeStream, ChangeStreamDocument, Document } from 'mongodb'
export class ChangeStreamEventifier<DocType extends Document> {
    isWatching: boolean = true;
    stream: ChangeStream<DocType>;
    delay: number;
    onChange: (doc: ChangeStreamDocument<DocType>) => void;
    constructor(stream: ChangeStream<DocType>, onChange: (doc: ChangeStreamDocument<DocType>) => void, checkDelayMillis: number = 1000) {
        this.stream = stream;
        this.delay = checkDelayMillis
        this.onChange = onChange;
        this.check();
    }
    stop() {
        this.isWatching = false;
        this.stream.close();
    }
    private async check() {
        // console.log('check')
        if (!this.isWatching || this.stream.closed) {
            console.log(`ChangeStream closed`)
            return;
        }
        if (await this.stream.hasNext()) {
            this.onChange(await this.stream.next());
        }
        let ths = this;
        setTimeout(() => { ths.check() }, this.delay)
    }
}
