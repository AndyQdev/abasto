package bo.abasto.pedidos;

import org.springframework.boot.SpringApplication;

public class TestPedidosApplication {

	public static void main(String[] args) {
		SpringApplication.from(PedidosApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
