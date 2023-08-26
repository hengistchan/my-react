class App extends React.Component {
	state = {
		foo: 1,
	};
	onClick() {
		this.setState({ foo: 2 });
		console.log('clicked', this.state.foo);
	}
}
