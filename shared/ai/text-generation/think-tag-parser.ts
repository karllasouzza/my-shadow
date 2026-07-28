export class ThinkTagParser {
  private inThinkTag = false;
  private buffer = "";

  reset(): void {
    this.inThinkTag = false;
    this.buffer = "";
  }

  parse(token: string): { token: string; reasoning: string } {
    let resultToken = "";
    let reasoning = "";

    this.buffer += token;

    while (this.buffer.length > 0) {
      if (!this.inThinkTag) {
        const thinkIndex = this.buffer.indexOf("<think>");

        if (thinkIndex === -1) {
          if (this.buffer.length < 7) {
            break;
          }
          resultToken += this.buffer;
          this.buffer = "";
        } else {
          resultToken += this.buffer.slice(0, thinkIndex);
          this.buffer = this.buffer.slice(thinkIndex + 7);
          this.inThinkTag = true;
        }
      } else {
        const thinkEndIndex = this.buffer.indexOf("</think>");

        if (thinkEndIndex === -1) {
          reasoning += this.buffer;
          this.buffer = "";
        } else {
          reasoning += this.buffer.slice(0, thinkEndIndex);
          this.buffer = this.buffer.slice(thinkEndIndex + 8);
          this.inThinkTag = false;
        }
      }
    }

    return { token: resultToken, reasoning };
  }

  flush(): { token: string; reasoning: string } {
    const result = {
      token: this.inThinkTag ? "" : this.buffer,
      reasoning: this.inThinkTag ? this.buffer : "",
    };
    this.buffer = "";
    return result;
  }
}
