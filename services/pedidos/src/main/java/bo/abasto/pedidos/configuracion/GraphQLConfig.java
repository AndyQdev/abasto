package bo.abasto.pedidos.configuracion;

import bo.abasto.pedidos.dominio.ErrorDeDominio;
import graphql.GraphQLError;
import graphql.GraphqlErrorBuilder;
import graphql.schema.DataFetchingEnvironment;
import java.util.Map;
import org.springframework.boot.graphql.autoconfigure.GraphQlSourceBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.graphql.data.federation.FederationSchemaFactory;
import org.springframework.graphql.execution.DataFetcherExceptionResolverAdapter;
import org.springframework.graphql.execution.ErrorType;

/** Subgrafo de Apollo Federation 2 y traducción de errores del dominio a errores de GraphQL con su código. */
@Configuration
class GraphQLConfig {

    @Bean
    FederationSchemaFactory federationSchemaFactory() {
        return new FederationSchemaFactory();
    }

    @Bean
    GraphQlSourceBuilderCustomizer federacion(FederationSchemaFactory fabrica) {
        return builder -> builder.schemaFactory(fabrica::createGraphQLSchema);
    }

    @Bean
    DataFetcherExceptionResolverAdapter erroresDelDominio() {
        return new DataFetcherExceptionResolverAdapter() {
            @Override
            protected GraphQLError resolveToSingleError(Throwable e, DataFetchingEnvironment env) {
                if (e instanceof ErrorDeDominio error) {
                    return GraphqlErrorBuilder.newError(env)
                            .errorType(ErrorType.BAD_REQUEST)
                            .message(error.getMessage())
                            .extensions(Map.of("code", error.codigo()))
                            .build();
                }
                return null;
            }
        };
    }
}
