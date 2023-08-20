import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

const Child = () => <h3>yuanbz shazi</h3>;

export function App() {
	const [num, dispatch] = useState(0);
	const arr =
		num % 2 === 0
			? [<li key={1}>1</li>, <li key={2}>2</li>, <li key={3}>3</li>]
			: [<li key={3}>3</li>, <li key={2}>2</li>, <li key={1}>1</li>];
	return <ul onClick={() => dispatch(num + 1)}>{arr}</ul>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
