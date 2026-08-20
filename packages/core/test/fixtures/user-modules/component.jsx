// Fixture: JSX in a `.jsx` file. Node rejects the extension outright and jiti's `jsx` option is
// off by default, so no dispatch branch can load it — it must be declined at resolution.
const element = <div className="thyme">hi</div>;

export default element;
