package bo.abasto.pedidos;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/**
 * Las reglas de la arquitectura hexagonal, probadas en cada PR.
 * Si alguien importa Spring en el dominio por apuro, CI falla.
 */
@AnalyzeClasses(packages = "bo.abasto.pedidos", importOptions = ImportOption.DoNotIncludeTests.class)
class ArquitecturaTest {

    @ArchTest
    static final ArchRule el_dominio_no_conoce_ningun_framework = noClasses()
            .that().resideInAPackage("..dominio..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("org.springframework..", "jakarta..", "org.hibernate..", "tools.jackson..",
                    "..aplicacion..", "..adaptadores..", "..configuracion..");

    @ArchTest
    static final ArchRule la_aplicacion_no_conoce_spring_ni_los_adaptadores = noClasses()
            .that().resideInAPackage("..aplicacion..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("org.springframework..", "jakarta..", "..adaptadores..", "..configuracion..");

    @ArchTest
    static final ArchRule capas_hexagonales = layeredArchitecture()
            .consideringOnlyDependenciesInLayers()
            .layer("Dominio").definedBy("..dominio..")
            .layer("Aplicacion").definedBy("..aplicacion..")
            .layer("Adaptadores").definedBy("..adaptadores..")
            .layer("Configuracion").definedBy("..configuracion..")
            .whereLayer("Adaptadores").mayOnlyBeAccessedByLayers("Configuracion")
            .whereLayer("Aplicacion").mayOnlyBeAccessedByLayers("Adaptadores", "Configuracion")
            .whereLayer("Dominio").mayOnlyBeAccessedByLayers("Aplicacion", "Adaptadores", "Configuracion");

    @ArchTest
    static final ArchRule los_adaptadores_de_entrada_no_tocan_la_base = noClasses()
            .that().resideInAPackage("..adaptadores.entrada..")
            .should().dependOnClassesThat().resideInAPackage("..adaptadores.salida..");
}
